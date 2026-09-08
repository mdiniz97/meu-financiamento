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
  downPaymentParcela?: number;
  downPaymentAvista?: number;
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
  if (!Number.isFinite(input.propertyValue) || !(input.propertyValue > 0))
    throw new Error('Valor do imóvel deve ser maior que zero.');
  if (!(input.downPaymentPct >= 0 && input.downPaymentPct < 100))
    throw new Error('Entrada deve ficar entre 0% e 99%.');
  if (!Number.isFinite(input.annualRate) || !(input.annualRate >= 0)) throw new Error('Taxa anual inválida.');
  if (!Number.isInteger(input.monthsUntilDelivery) || !(input.monthsUntilDelivery >= 1 && input.monthsUntilDelivery <= 120))
    throw new Error('Prazo até a entrega deve ficar entre 1 e 120 meses.');
  if (!(input.progressPct >= 0 && input.progressPct <= 100))
    throw new Error('Obra concluída deve ficar entre 0% e 100%.');
  if (!Number.isFinite(input.insuranceMonthly) || !(input.insuranceMonthly >= 0))
    throw new Error('Seguro mensal inválido.');
  if (input.downPaymentAnnualRate !== undefined &&
      (!Number.isFinite(input.downPaymentAnnualRate) || input.downPaymentAnnualRate < 0))
    throw new Error('Taxa da entrada inválida.');
  if (input.downPaymentParcela !== undefined &&
      (!Number.isFinite(input.downPaymentParcela) || input.downPaymentParcela < 0))
    throw new Error('Parcela da entrada inválida.');
  if (input.downPaymentAvista !== undefined &&
      (!Number.isFinite(input.downPaymentAvista) || input.downPaymentAvista < 0))
    throw new Error('Entrada à vista inválida.');

  const financed = input.propertyValue * (1 - input.downPaymentPct / 100);
  const monthlyRate = Math.pow(1 + input.annualRate, 1 / 12) - 1;
  const progress = Math.min(input.progressPct, 100);
  const remainingPct = 100 - progress;

  const entrada = input.propertyValue * (input.downPaymentPct / 100);
  const financedAmount = input.downPaymentFinancedAmount;
  if (!Number.isFinite(financedAmount) || !(financedAmount >= 0 && financedAmount <= entrada + 1e-6))
    throw new Error('Valor parcelado da entrada inválido.');

  const monthsEntrada = input.downPaymentMonths ?? input.monthsUntilDelivery;
  if (!Number.isInteger(monthsEntrada) || !(monthsEntrada >= 1 && monthsEntrada <= 120))
    throw new Error('Parcelas da entrada devem ficar entre 1 e 120.');

  let entradaParcela = 0;
  let entradaParceladaTotal = 0;
  if (input.downPaymentParcela && input.downPaymentParcela > 0) {
    // A pessoa já sabe quanto paga por mês (ex.: com juros embutidos da maquininha).
    entradaParcela = input.downPaymentParcela;
    entradaParceladaTotal = entradaParcela * monthsEntrada;
  } else if (financedAmount > 0) {
    const rate = (input.downPaymentAnnualRate ?? 0) > 0
      ? Math.pow(1 + (input.downPaymentAnnualRate ?? 0), 1 / 12) - 1
      : 0;
    entradaParcela =
      rate > 0
        ? (financedAmount * rate) / (1 - Math.pow(1 + rate, -monthsEntrada))
        : financedAmount / monthsEntrada;
    entradaParceladaTotal = entradaParcela * monthsEntrada;
  }
  const avistaInformado =
    input.downPaymentParcela && input.downPaymentParcela > 0 && input.downPaymentAvista !== undefined;
  if (avistaInformado && input.downPaymentAvista! + entradaParceladaTotal < entrada - 1)
    throw new Error('Entrada à vista + parcelas não cobre a entrada.');
  // O que não cabe nas parcelas é pago à vista na assinatura. No modo "parcela
  // conhecida" sem à vista informado, se as parcelas somam menos que a
  // entrada, o restante é à vista (total = entrada).
  const entradaAvista =
    avistaInformado
      ? input.downPaymentAvista!
      : input.downPaymentParcela && input.downPaymentParcela > 0
        ? Math.max(0, entrada - entradaParceladaTotal)
        : entrada - financedAmount;
  const totalEntrada = entradaAvista + entradaParceladaTotal;

  const monthly: ObraMonth[] = [];
  for (let m = 1; m <= input.monthsUntilDelivery; m += 1) {
    const progressPctAtMonth = Math.min(100, progress + (remainingPct * m) / input.monthsUntilDelivery);
    const saldoLiberado = (financed * progressPctAtMonth) / 100;
    const juros = saldoLiberado * monthlyRate;
    const entradaDoMes = m <= monthsEntrada ? entradaParcela : 0;
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
  const totalDuranteObra = entradaAvista + monthly.reduce((acc, m) => acc + m.total, 0);
  const price = monthlyRate === 0
    ? financed / 360
    : financed * monthlyRate / (1 - Math.pow(1 + monthlyRate, -360));
  const sac = financed / 360 + financed * monthlyRate;
  if (![financed, monthlyRate, totalJuros, totalSeguro, totalEntrada, totalDuranteObra, price, sac].every(Number.isFinite))
    throw new Error('Resultado fora do limite numérico.');

  return {
    financed,
    monthlyRate,
    monthly,
    totalJuros,
    totalSeguro,
    totalEntrada,
    totalDuranteObra,
    primeiraParcelaPrice: price,
    primeiraParcelaSac: sac,
  };
}
