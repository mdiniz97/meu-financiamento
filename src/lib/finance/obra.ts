export interface ObraInput {
  propertyValue: number;
  downPaymentPct: number;
  annualRate: number;
  monthsUntilDelivery: number;
  progressPct: number;
  insuranceMonthly: number;
  downPaymentFinancedAmount: number;
  downPaymentMonths?: number;
  downPaymentAnnualRate?: number;
}

export interface ObraMonth {
  month: number;
  progressPct: number;
  saldoLiberado: number;
  juros: number;
  seguro: number;
  entradaParcela: number;
  total: number;
}

export interface ObraResult {
  financed: number;
  monthlyRate: number;
  monthly: ObraMonth[];
  totalJuros: number;
  totalSeguro: number;
  totalEntrada: number;
  totalDuranteObra: number;
  primeiraParcelaPrice: number;
  primeiraParcelaSac: number;
}

export function calcularJurosDeObra(input: ObraInput): ObraResult {
  if (!(input.propertyValue > 0)) throw new Error('Valor do imóvel deve ser maior que zero.');
  if (!(input.downPaymentPct >= 0 && input.downPaymentPct < 100))
    throw new Error('Entrada deve ficar entre 0% e 99%.');
  if (!(input.annualRate >= 0)) throw new Error('Taxa anual inválida.');
  if (!(input.monthsUntilDelivery >= 1 && input.monthsUntilDelivery <= 120))
    throw new Error('Prazo até a entrega deve ficar entre 1 e 120 meses.');
  if (!(input.progressPct >= 0 && input.progressPct <= 100))
    throw new Error('Obra concluída deve ficar entre 0% e 100%.');
  if (!(input.insuranceMonthly >= 0)) throw new Error('Seguro mensal inválido.');

  const financed = input.propertyValue * (1 - input.downPaymentPct / 100);
  const monthlyRate = Math.pow(1 + input.annualRate, 1 / 12) - 1;
  const progress = Math.min(input.progressPct, 100);
  const remainingPct = 100 - progress;

  const entrada = input.propertyValue * (input.downPaymentPct / 100);
  const financedAmount = input.downPaymentFinancedAmount;
  if (!(financedAmount >= 0 && financedAmount <= entrada + 1e-6))
    throw new Error('Valor parcelado da entrada inválido.');

  let entradaParcela = 0;
  if (financedAmount > 0) {
    const months = input.downPaymentMonths ?? input.monthsUntilDelivery;
    if (!(months >= 1 && months <= 120)) throw new Error('Parcelas da entrada devem ficar entre 1 e 120.');
    const rate = (input.downPaymentAnnualRate ?? 0) > 0
      ? Math.pow(1 + (input.downPaymentAnnualRate ?? 0), 1 / 12) - 1
      : 0;
    entradaParcela =
      rate > 0
        ? (financedAmount * rate) / (1 - Math.pow(1 + rate, -months))
        : financedAmount / months;
  }
  const totalEntrada =
    (entrada - financedAmount) +
    entradaParcela * (input.downPaymentMonths ?? input.monthsUntilDelivery);

  const monthly: ObraMonth[] = [];
  for (let m = 1; m <= input.monthsUntilDelivery; m += 1) {
    const progressPctAtMonth = Math.min(100, progress + (remainingPct * m) / input.monthsUntilDelivery);
    const saldoLiberado = (financed * progressPctAtMonth) / 100;
    const juros = saldoLiberado * monthlyRate;
    const entradaDoMes = m <= (input.downPaymentMonths ?? input.monthsUntilDelivery) ? entradaParcela : 0;
    monthly.push({
      month: m,
      progressPct: progressPctAtMonth,
      saldoLiberado,
      juros,
      seguro: input.insuranceMonthly,
      entradaParcela: entradaDoMes,
      total: juros + input.insuranceMonthly + entradaDoMes,
    });
  }

  const totalJuros = monthly.reduce((acc, m) => acc + m.juros, 0);
  const totalSeguro = monthly.reduce((acc, m) => acc + m.seguro, 0);
  const price = financed * monthlyRate / (1 - Math.pow(1 + monthlyRate, -360));
  const sac = financed / 360 + financed * monthlyRate;

  return {
    financed,
    monthlyRate,
    monthly,
    totalJuros,
    totalSeguro,
    totalEntrada,
    totalDuranteObra: totalJuros + totalSeguro + totalEntrada,
    primeiraParcelaPrice: price,
    primeiraParcelaSac: sac,
  };
}
