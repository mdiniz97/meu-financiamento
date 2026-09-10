import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga, Projecao } from './model';

function somaParcelas(projecao: Projecao): number {
  return projecao.parcelas.reduce((soma, parcela) => soma + parcela.parcela, 0);
}

/**
 * Total economizado pelas amortizações extras do estado vigente: diferença
 * entre o total ainda a pagar sem extras e com extras, ambos projetados da
 * mesma posição (parcelas já pagas encadeadas). O cenário com extras embute o
 * efeito real do modelo: term encurta o prazo, payment derruba a parcela.
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
  const semExtras = projecao(params, baseline, pagas, []);
  const comExtras = projecao(params, baseline, pagas, extras);
  return somaParcelas(semExtras) - somaParcelas(comExtras);
}
