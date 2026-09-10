import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import type { SimulationResult } from '../types';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
} from './model';

/** Encargos do cenário: juros + correção (TR) + seguro. */
function encargos(resultado: SimulationResult): number {
  return resultado.metrics.totalJuros + resultado.metrics.totalCorrecao + resultado.metrics.totalSeguro;
}

/**
 * Economia real das amortizações extras do estado vigente: encargos evitados
 * (juros, correção e seguro), na MESMA métrica do simulador
 * (`base.metrics.totalPago − current.metrics.totalPago`, que para o mesmo
 * principal é a diferença de encargos). O cenário parte da posição vigente
 * (saldo após as parcelas pagas, meses restantes da projecao) e aplica o total
 * dos extras no mês 1, com modo term quando qualquer extra é term.
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

  const loan = { ...toLoanInput(params, baseline), principal, months: meses };
  const modo = extras.some((extra) => extra.modo === 'term') ? 'term' : 'payment';
  const semAportes = simulate(loan);
  const comAportes = simulate(loan, {
    extraLumpSum: [{ month: 1, amount: Math.min(totalExtras, principal), reduceMode: modo }],
    reduceMode: modo,
  });
  return encargos(semAportes) - encargos(comAportes);
}
