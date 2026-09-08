export interface ConsorcioInvestirInput {
  valor: number;
  prazoMeses: number;
  taxaAdminPct: number;
  selicAnual: number;
}

export interface ConsorcioInvestirResult {
  valor: number;
  prazoMeses: number;
  taxaAdminPct: number;
  selicAnual: number;
  parcelaMensal: number;
  custoAdministracao: number;
  totalConsorcio: number;
  mesCompraAvista: number;
  mesCompraAvistaAnos: number;
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

export function calcularConsorcioOuInvestir(input: ConsorcioInvestirInput): ConsorcioInvestirResult {
  if (!Number.isFinite(input.valor) || !(input.valor > 0)) throw new Error('Valor do crédito deve ser maior que zero.');
  if (!Number.isInteger(input.prazoMeses) || !(input.prazoMeses >= 1 && input.prazoMeses <= 600))
    throw new Error('Prazo deve ficar entre 1 e 600 meses.');
  if (!Number.isFinite(input.taxaAdminPct) || !(input.taxaAdminPct >= 0)) throw new Error('Taxa de administração inválida.');
  if (!Number.isFinite(input.selicAnual) || !(input.selicAnual >= 0)) throw new Error('Taxa de investimento inválida.');

  const totalConsorcio = input.valor * (1 + input.taxaAdminPct / 100);
  const parcelaMensal = totalConsorcio / input.prazoMeses;
  const i = monthlyRate(input.selicAnual);
  if (!Number.isFinite(totalConsorcio) || !Number.isFinite(parcelaMensal) || !(parcelaMensal > 0))
    throw new Error('Resultado fora do limite numérico.');

  // Investidor aplica a mesma parcela todo mês até juntar o valor do crédito.
  let fv = 0;
  let mesCompraAvista = 0;
  for (let m = 1; m <= input.prazoMeses; m += 1) {
    fv = i === 0 ? parcelaMensal * m : fv * (1 + i) + parcelaMensal;
    if (!Number.isFinite(fv)) throw new Error('Resultado fora do limite numérico.');
    // Compensa erro acumulado de ponto flutuante, sempre abaixo de um centavo.
    const tolerance = Math.min(0.001, input.valor * Number.EPSILON * m * 4);
    if (fv >= input.valor || input.valor - fv <= tolerance) {
      mesCompraAvista = m;
      break;
    }
  }
  if (mesCompraAvista === 0) throw new Error('Resultado fora do limite numérico.');

  return {
    valor: input.valor,
    prazoMeses: input.prazoMeses,
    taxaAdminPct: input.taxaAdminPct,
    selicAnual: input.selicAnual,
    parcelaMensal,
    custoAdministracao: totalConsorcio - input.valor,
    totalConsorcio,
    mesCompraAvista,
    mesCompraAvistaAnos: Math.round((mesCompraAvista / 12) * 10) / 10,
  };
}
