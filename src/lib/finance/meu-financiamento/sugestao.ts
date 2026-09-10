import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga } from './model';

/**
 * Menor valor de amortização extra (modo term, passo de R$ 0,01) que faz a
 * projeção quitar pelo menos uma parcela antes do cenário atual. A data do
 * candidato é irrelevante para o modelo (extras entram pelo valor total), então
 * usa a data-base. Retorna null quando não há o que encurtar: saldo zerado,
 * contrato já quitado ou sem parcela projetada.
 */
export function limiarUmaParcela(
  params: ContractParams,
  baseline: Baseline,
  pagas: ParcelaPaga[],
  extras: AmortizacaoExtra[],
): number | null {
  const atual = projecao(params, baseline, pagas, extras);
  const baseQuita = atual.quitaEm;
  if (atual.saldoEfetivo <= 0 || baseQuita == null) return null;

  const candidato = (valor: number): AmortizacaoExtra => ({
    dataPagamento: baseline.dataBase,
    valor,
    origem: 'proprio',
    modo: 'term',
  });
  const reduzPrazo = (centavos: number): boolean => {
    const comAporte = projecao(params, baseline, pagas, [...extras, candidato(centavos / 100)]);
    // Quitação total do saldo também encurta: a projeção fica vazia e o
    // quitaEm vira null, mas o prazo restante caiu para zero.
    if (comAporte.saldoEfetivo === 0) return true;
    return comAporte.quitaEm != null && comAporte.quitaEm <= baseQuita - 1;
  };

  // Bisseção no primeiro centavo com efeito. O teto (saldoEfetivo inteiro)
  // sempre reduz (quita o contrato), então o predicado é monótono no intervalo;
  // projecao é pura e barata e a busca converge em ~log2(saldo em centavos).
  let lo = 1;
  let hi = Math.max(1, Math.round(atual.saldoEfetivo * 100));
  if (!reduzPrazo(hi)) return null;
  while (lo < hi) {
    const meio = Math.floor((lo + hi) / 2);
    if (reduzPrazo(meio)) hi = meio;
    else lo = meio + 1;
  }
  return lo / 100;
}
