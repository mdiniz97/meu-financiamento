import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import type { LoanInput } from '../types';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga } from './model';

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
