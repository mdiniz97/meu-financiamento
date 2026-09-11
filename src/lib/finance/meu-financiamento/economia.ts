import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import type { LoanInput } from '../types';
import type { AmortizacaoExtra, Baseline, ContractParams, ContractSystem, ParcelaPaga } from './model';

/** Período (baseline versionado) mínimo para reconstruir o cenário de uma
 *  versão. Estruturalmente satisfeito por `ContractStateSummary` do repo. */
export interface PeriodoEstado {
  id: string;
  version: number;
  saldoDevedor: number;
  dataBase: string;
  proximaParcelaNumero: number;
  diaVencimento: number;
  bank: string;
  system: ContractSystem;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  parcelasTotais: number;
}

/** Lançamentos de todos os períodos, com o `stateId` que liga cada um ao seu
 *  baseline. Estruturalmente satisfeito por `PageState.historico`. */
export interface HistoricoMovimentos {
  pagas: (ParcelaPaga & { stateId: string })[];
  extras: (AmortizacaoExtra & { stateId: string })[];
}

/**
 * Economia de um aporte pontual no mês 1 na MESMA métrica do simulador e do
 * painel "E se?": diferença de `totalPago` entre o cenário base e o cenário com
 * o aporte (nunca negativa). É o helper compartilhado pelas três superfícies
 * para os números baterem por construção.
 */
export function economiaDoAporte(
  input: LoanInput,
  aporte: number,
  reduceMode: 'term' | 'payment' = 'term',
): number {
  const base = simulate(input);
  const cenario = simulate(input, {
    extraLumpSum: [{ month: 1, amount: aporte, reduceMode }],
    reduceMode,
  });
  return Math.max(0, base.metrics.totalPago - cenario.metrics.totalPago);
}

/**
 * Menor aporte (centavos, modo term, mês 1) que encurta a quitação na ENGINE
 * (`saldoZeroAt` menor que o do cenário base), ou seja, o menor valor que o
 * painel "E se?" reconhece como efeito no prazo. Bisseção em centavos de 1 até
 * o principal; retorna null sem principal ou sem efeito.
 */
export function limiarParcelaEngine(input: LoanInput): number | null {
  if (!(input.principal > 0)) return null;
  const base = simulate(input);
  const baseZero = base.metrics.saldoZeroAt;
  if (baseZero <= 0) return null;
  const corta = (centavos: number): boolean =>
    simulate(input, {
      extraLumpSum: [{ month: 1, amount: centavos / 100, reduceMode: 'term' }],
      reduceMode: 'term',
    }).metrics.saldoZeroAt < baseZero;

  let lo = 1;
  let hi = Math.max(1, Math.ceil(input.principal * 100));
  if (!corta(hi)) return null;
  while (lo < hi) {
    const meio = Math.floor((lo + hi) / 2);
    if (corta(meio)) hi = meio;
    else lo = meio + 1;
  }
  return lo / 100;
}

/**
 * Economia real das amortizações extras do estado vigente, na métrica
 * compartilhada (encargos evitados = diferença de totalPago, que com o mesmo
 * principal total é juros+correção+seguro evitados). O cenário parte da posição
 * vigente (saldo após as parcelas pagas, meses restantes da projecao) e aplica
 * o total dos extras no mês 1, com modo term quando qualquer extra é term.
 *
 * A soma de juros+correção+seguro das parcelas do `projecao` NÃO serve: o modo
 * term do model (bisseção pmt sobre o saldo efetivo) difere do cronograma
 * contratual da engine e dava 601.588,26 no cenário padrão contra os
 * 601.065,98 do simulador.
 *
 * Use SEMPRE os extras do estado vigente (params/baseline/pagas/extras de
 * PageState), nunca o histórico completo: amortizações de baselines superados
 * já foram incorporadas ao saldo do baseline novo e reaplicá-las duplicaria a
 * economia.
 */
export function economiaAmortizacoes(
  params: ContractParams,
  baseline: Baseline,
  pagas: ParcelaPaga[],
  extras: AmortizacaoExtra[],
): number {
  if (extras.length === 0) return 0;
  const totalExtras = extras.reduce((soma, extra) => soma + extra.valor, 0);
  if (totalExtras <= 0) return 0;

  const semExtras = projecao(params, baseline, pagas, []);
  const principal = semExtras.saldoAntesExtras;
  const meses = params.parcelasTotais - semExtras.primeiraPendente + 1;
  if (principal <= 0 || meses < 1) return 0;

  const input: LoanInput = { ...toLoanInput(params, baseline), principal, months: meses };
  const modo = extras.some((extra) => extra.modo === 'term') ? 'term' : 'payment';
  return economiaDoAporte(input, Math.min(totalExtras, principal), modo);
}

/**
 * Economia ACUMULADA das amortizações de TODOS os períodos do contrato: soma,
 * por baseline versionado, a economia dos extras registrados naquele período.
 *
 * Por que por período, e não no estado vigente: recalibrar/editar cria um
 * baseline novo cujo saldo JÁ embute as amortizações do período anterior (source
 * 'atualizacao'/'recalibracao' parte do saldo efetivo). Se os extras antigos
 * fossem reaplicados sobre o baseline novo a economia seria contada em dobro;
 * e se o cálculo olhasse só os extras do estado VIGENTE, a economia zeraria a
 * cada edição (os extras ficam congelados no período superado). Reconstruir o
 * cenário de cada período com os lançamentos que pertencem a ele (agrupados por
 * `stateId`) preserva o acumulado sem dupla contagem.
 */
export function economiaAcumulada(states: PeriodoEstado[], historico: HistoricoMovimentos): number {
  return states.reduce((total, state) => {
    const params: ContractParams = {
      bank: state.bank,
      system: state.system,
      annualRate: state.annualRate,
      trMonthly: state.trMonthly,
      insuranceMonthly: state.insuranceMonthly,
      parcelasTotais: state.parcelasTotais,
    };
    const baseline: Baseline = {
      version: state.version,
      saldoDevedor: state.saldoDevedor,
      dataBase: state.dataBase,
      proximaParcelaNumero: state.proximaParcelaNumero,
      diaVencimento: state.diaVencimento,
    };
    const pagas = historico.pagas.filter((paga) => paga.stateId === state.id);
    const extras = historico.extras.filter((extra) => extra.stateId === state.id);
    return total + economiaAmortizacoes(params, baseline, pagas, extras);
  }, 0);
}
