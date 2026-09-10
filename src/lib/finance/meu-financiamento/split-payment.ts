export interface PagamentoSplit {
  parcela: number;
  amortizacao: number;
}

/**
 * Divide o valor pago entre a parcela projetada e a amortização extra. Só o
 * que passa da parcela projetada em mais de meio centavo vira amortização; um
 * valor abaixo do projetado é pagamento parcial (a parcela recebe o valor
 * real, sem amortização).
 */
export function splitPagamento(parcelaProjetada: number, valorPago: number): PagamentoSplit {
  const amortizacao = valorPago > parcelaProjetada + 0.005 ? valorPago - parcelaProjetada : 0;
  return { parcela: valorPago - amortizacao, amortizacao };
}
