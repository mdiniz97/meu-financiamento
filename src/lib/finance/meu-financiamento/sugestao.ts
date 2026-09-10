import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga } from './model';

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Menor aporte (modo term, passo de R$ 0,01) que, pago JUNTO com a parcela do
 * mês, encurta a quitação em pelo menos 1 parcela. O fluxo real paga
 * `roundCents(parcelaProjetada) + aporte` (centavos exatos), então a validação
 * usa o extra EFETIVO `aporte + (roundCents(parcela) - parcela)`: o "quita 1
 * parcela antes" vale para o que o banco recebe, não para o centavo exibido.
 * Retorna null quando não há o que encurtar (saldo zerado, sem parcela
 * projetada ou quitação já fora do prazo).
 */
export function limiarUmaParcela(
  params: ContractParams,
  baseline: Baseline,
  pagas: ParcelaPaga[],
  extras: AmortizacaoExtra[],
): number | null {
  const atual = projecao(params, baseline, pagas, extras);
  const primeira = atual.parcelas[0];
  if (atual.saldoEfetivo <= 0 || atual.quitaEm == null || primeira == null) return null;

  const pagasComParcela: ParcelaPaga[] = [
    ...pagas,
    { parcelaNumero: primeira.parcelaNumero, valor: primeira.parcela, dataPagamento: baseline.dataBase },
  ];
  const semAporte = projecao(params, baseline, pagasComParcela, extras);
  const baseQuita = semAporte.quitaEm;
  if (baseQuita == null) return null;

  const desvio = roundCents(primeira.parcela) - primeira.parcela;
  const candidato = (valor: number): AmortizacaoExtra => ({
    dataPagamento: baseline.dataBase,
    valor,
    origem: 'proprio',
    modo: 'term',
  });
  const reduzPrazo = (centavos: number): boolean => {
    const comAporte = projecao(params, baseline, pagasComParcela, [...extras, candidato(centavos / 100 + desvio)]);
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
