import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import { economiaDoAporte } from './economia';
import type { LoanInput } from '../types';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga, Projecao } from './model';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Estado vigente necessário para simular o efeito de um aporte. */
export interface EstadoCenarioAporte {
  params: ContractParams;
  baseline: Baseline;
  pagas: ParcelaPaga[];
  extras: AmortizacaoExtra[];
  projecao: Projecao;
}

export interface CenarioAporte {
  /** Economia total na métrica do painel "E se?" (diferença de totalPago). */
  economia: number;
  /** Parcelas que a projeção vigente perde com o aporte no modo term. */
  parcelasEliminadas: number;
  /** Parcela estimada no modo payment quando a engine a reduz; senão null. */
  parcelaEstimada: number | null;
}

/**
 * Cenário ÚNICO do efeito de um aporte sobre o estado vigente, compartilhado
 * pelo card de sugestão e pelos previews (mesmos números nos dois lugares).
 *
 * A economia usa `economiaDoAporte` (métrica do E se?) e o corte usa a
 * `projecao` do estado com o aporte no modo term. O cenário inclui o desvio do
 * arredondamento (`roundCents(parcela) - parcela`) porque o fluxo real paga
 * `roundCents(parcela) + aporte`; o form e o card usam exatamente esse desvio.
 *
 * No modo payment não há corte de prazo: `parcelasEliminadas` é 0 e, quando
 * `parcelaEstimada` é pedida, usa o mês 2 da engine (o mês 1 carrega o aporte).
 */
export function cenarioAporte(
  estado: EstadoCenarioAporte,
  aporte: number,
  modo: 'term' | 'payment',
  opcoes: { parcelaEstimada?: boolean } = {},
): CenarioAporte | null {
  const { params, baseline, pagas, extras, projecao: atual } = estado;
  if (!Number.isFinite(aporte) || aporte <= 0) return null;
  if (atual.saldoEfetivo <= 0) return null;
  const meses = params.parcelasTotais - atual.primeiraPendente + 1;
  if (meses < 1) return null;

  const input: LoanInput = { ...toLoanInput(params, baseline), principal: atual.saldoEfetivo, months: meses };
  const economia = economiaDoAporte(input, aporte, modo);

  if (modo === 'payment') {
    let parcelaEstimada: number | null = null;
    if (opcoes.parcelaEstimada) {
      try {
        const cenario = simulate(input, {
          extraLumpSum: [{ month: 1, amount: aporte, reduceMode: 'payment' }],
          reduceMode: 'payment',
        });
        // Mês 1 inclui o aporte; a parcela reduzida vale do mês 2 em diante.
        const proxima = cenario.installments[1]?.parcela ?? cenario.installments[0]?.parcela ?? null;
        const atualParcela = atual.parcelas[0]?.parcela ?? null;
        parcelaEstimada =
          proxima != null && atualParcela != null && proxima < atualParcela - 0.005
            ? roundCents(proxima)
            : null;
      } catch {
        parcelaEstimada = null;
      }
    }
    return { economia, parcelasEliminadas: 0, parcelaEstimada };
  }

  const primeira = atual.parcelas[0];
  const desvio = primeira ? roundCents(primeira.parcela) - primeira.parcela : 0;
  const comAporte = projecao(params, baseline, pagas, [
    ...extras,
    { dataPagamento: baseline.dataBase, valor: aporte + desvio, origem: 'proprio', modo: 'term' },
  ]);
  return {
    economia,
    parcelasEliminadas: Math.max(0, atual.parcelas.length - comAporte.parcelas.length),
    parcelaEstimada: null,
  };
}
