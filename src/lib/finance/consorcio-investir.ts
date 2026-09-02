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
  if (!(input.valor > 0)) throw new Error('Valor do crédito deve ser maior que zero.');
  if (!(input.prazoMeses >= 1 && input.prazoMeses <= 600))
    throw new Error('Prazo deve ficar entre 1 e 600 meses.');
  if (!(input.taxaAdminPct >= 0)) throw new Error('Taxa de administração inválida.');
  if (!(input.selicAnual >= 0)) throw new Error('Taxa de investimento inválida.');

  const totalConsorcio = input.valor * (1 + input.taxaAdminPct / 100);
  const parcelaMensal = totalConsorcio / input.prazoMeses;
  const i = monthlyRate(input.selicAnual);

  // Investidor aplica a mesma parcela todo mês até juntar o valor do crédito.
  let fv = 0;
  let mesCompraAvista = input.prazoMeses;
  for (let m = 1; m <= 3600; m += 1) {
    fv = fv * (1 + i) + parcelaMensal;
    if (fv >= input.valor) {
      mesCompraAvista = m;
      break;
    }
  }

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
