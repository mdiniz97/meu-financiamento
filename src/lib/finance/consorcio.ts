export interface ConsorcioInput {
  valor: number;
  prazoMeses: number;
  taxaAdminPct: number;
  taxaFinanciamento: number;
}

export interface ConsorcioResult {
  valor: number;
  prazoMeses: number;
  taxaAdminPct: number;
  parcelaConsorcio: number;
  totalConsorcio: number;
  custoConsorcio: number;
  parcelaFinanciamento: number;
  totalFinanciamento: number;
  jurosFinanciamento: number;
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

export function calcularConsorcioOuFinanciamento(input: ConsorcioInput): ConsorcioResult {
  if (!(input.valor > 0)) throw new Error('Valor do crédito deve ser maior que zero.');
  if (!(input.prazoMeses >= 1 && input.prazoMeses <= 600))
    throw new Error('Prazo deve ficar entre 1 e 600 meses.');
  if (!(input.taxaAdminPct >= 0)) throw new Error('Taxa de administração inválida.');
  if (!(input.taxaFinanciamento >= 0)) throw new Error('Taxa do financiamento inválida.');

  // Consórcio: o crédito é pago diluído + taxa de administração sobre o crédito.
  const totalConsorcio = input.valor * (1 + input.taxaAdminPct / 100);
  const parcelaConsorcio = totalConsorcio / input.prazoMeses;

  // Financiamento: PRICE sobre o mesmo valor, no mesmo prazo.
  const i = monthlyRate(input.taxaFinanciamento);
  const parcelaFinanciamento =
    i === 0
      ? input.valor / input.prazoMeses
      : (input.valor * i) / (1 - Math.pow(1 + i, -input.prazoMeses));
  const totalFinanciamento = parcelaFinanciamento * input.prazoMeses;

  return {
    valor: input.valor,
    prazoMeses: input.prazoMeses,
    taxaAdminPct: input.taxaAdminPct,
    parcelaConsorcio,
    totalConsorcio,
    custoConsorcio: totalConsorcio - input.valor,
    parcelaFinanciamento,
    totalFinanciamento,
    jurosFinanciamento: totalFinanciamento - input.valor,
  };
}
