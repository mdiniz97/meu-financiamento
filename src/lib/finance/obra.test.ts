import { describe, expect, it } from 'vitest';
import { calcularJurosDeObra, type ObraInput } from './obra';

const BASE: ObraInput = {
  propertyValue: 300000,
  downPaymentPct: 20,
  annualRate: 0.12,
  monthsUntilDelivery: 24,
  progressPct: 0,
  insuranceMonthly: 0,
  downPaymentFinancedAmount: 0,
};

describe('calcularJurosDeObra', () => {
  it('calcula juros mensais sobre o saldo liberado progressivamente', () => {
    const r = calcularJurosDeObra(BASE);
    expect(r.monthly).toHaveLength(24);
    // financiado = 240.000; mês 1 libera 10.000; juros = 10.000 × mensal efetiva
    const monthlyRate = Math.pow(1.12, 1 / 12) - 1;
    expect(r.monthly[0].saldoLiberado).toBeCloseTo(10000, 4);
    expect(r.monthly[0].juros).toBeCloseTo(10000 * monthlyRate, 4);
    expect(r.monthly[23].saldoLiberado).toBeCloseTo(240000, 4);
    expect(r.monthly[23].juros).toBeCloseTo(240000 * monthlyRate, 4);
  });

  it('soma juros e seguro mês a mês', () => {
    const r = calcularJurosDeObra({ ...BASE, insuranceMonthly: 50 });
    expect(r.monthly[0].seguro).toBe(50);
    expect(r.monthly[0].total).toBeCloseTo(r.monthly[0].juros + 50, 4);
    expect(r.totalSeguro).toBeCloseTo(50 * 24, 4);
    expect(r.totalJuros).toBeCloseTo(
      r.monthly.reduce((acc, m) => acc + m.juros, 0),
      4
    );
  });

  it('considera a obra já iniciada: só libera o restante a partir do progresso atual', () => {
    const r = calcularJurosDeObra({ ...BASE, progressPct: 50 });
    expect(r.monthly).toHaveLength(24);
    expect(r.monthly[0].saldoLiberado).toBeCloseTo(120000 + 5000, 4);
    expect(r.monthly[23].saldoLiberado).toBeCloseTo(240000, 4);
  });

  it('obra 100% concluída: juros sobre o total financiado desde o mês 1', () => {
    const r = calcularJurosDeObra({ ...BASE, progressPct: 100 });
    const monthlyRate = Math.pow(1.12, 1 / 12) - 1;
    expect(r.monthly[0].saldoLiberado).toBeCloseTo(240000, 4);
    expect(r.monthly[0].juros).toBeCloseTo(240000 * monthlyRate, 4);
  });

  it('primeira parcela após entrega: PRICE em 360 meses sobre o financiado', () => {
    const r = calcularJurosDeObra(BASE);
    const monthlyRate = Math.pow(1.12, 1 / 12) - 1;
    const esperado = (240000 * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -360));
    expect(r.primeiraParcelaPrice).toBeCloseTo(esperado, 2);
    expect(r.primeiraParcelaSac).toBeCloseTo(240000 / 360 + 240000 * monthlyRate, 2);
    expect(r.primeiraParcelaSac).toBeGreaterThan(r.primeiraParcelaPrice);
  });

  it('taxa zero divide o saldo financiado por 360 sem gerar NaN', () => {
    const r = calcularJurosDeObra({ ...BASE, annualRate: 0 });
    expect(r.primeiraParcelaPrice).toBeCloseTo(666.6666666666666, 8);
    expect(r.primeiraParcelaSac).toBe(r.primeiraParcelaPrice);
    expect(r.totalJuros).toBe(0);
  });

  it('reproduz o exemplo de referência: 1M financiado, 11% a.a., 30 meses', () => {
    const r = calcularJurosDeObra({
      propertyValue: 1300000,
      downPaymentPct: (300000 / 1300000) * 100,
      annualRate: 0.11,
      monthsUntilDelivery: 30,
      progressPct: 0,
      insuranceMonthly: 0,
      downPaymentFinancedAmount: 0,
    });
    // mês 15: metade liberada → juros ≈ 500.000 × 0,8735%
    expect(r.monthly[14].saldoLiberado).toBeCloseTo(500000, 0);
    expect(r.monthly[14].juros).toBeCloseTo(4367.5, 0);
    // total ≈ saldo médio (500k) × taxa mensal × 30 ≈ R$ 131–140 mil
    expect(r.totalJuros).toBeGreaterThan(130000);
    expect(r.totalJuros).toBeLessThan(140000);
    // primeira parcela PRICE em 360 meses não pode superar 10% do financiado
    expect(r.primeiraParcelaPrice).toBeLessThan(100000);
  });

  it('estima o percentual de obra concluída mês a mês', () => {
    const r = calcularJurosDeObra(BASE);
    expect(r.monthly[0].progressPct).toBeCloseTo(100 / 24, 4);
    expect(r.monthly[23].progressPct).toBe(100);
    const parcial = calcularJurosDeObra({ ...BASE, progressPct: 50 });
    expect(parcial.monthly[0].progressPct).toBeCloseTo(50 + 50 / 24, 4);
    expect(parcial.monthly[23].progressPct).toBe(100);
  });

  it('entrada parcelada sem juros: parcela = valor parcelado / parcelas e entra no mês', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      downPaymentFinancedAmount: 30000,
      downPaymentMonths: 12,
    });
    // 30.000 parcelados em 12x sem juros = 2.500/mês; restante (30.000) à vista
    expect(r.monthly[0].entradaParcela).toBe(2500);
    expect(r.monthly[11].entradaParcela).toBe(2500);
    expect(r.monthly[12].entradaParcela).toBe(0);
    expect(r.monthly[0].total).toBeCloseTo(r.monthly[0].juros + 2500, 4);
    expect(r.totalEntrada).toBeCloseTo(60000, 4);
  });

  it('entrada parcelada com juros: parcela de PRICE sobre o valor parcelado', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      downPaymentFinancedAmount: 30000,
      downPaymentMonths: 12,
      downPaymentAnnualRate: 0.12,
    });
    const entradaRate = Math.pow(1.12, 1 / 12) - 1;
    const esperado = (30000 * entradaRate) / (1 - Math.pow(1 + entradaRate, -12));
    expect(r.monthly[0].entradaParcela).toBeCloseTo(esperado, 2);
    expect(r.totalEntrada).toBeCloseTo(30000 + esperado * 12, 2);
    expect(r.totalEntrada).toBeGreaterThan(60000);
  });

  it.each([
    { downPaymentFinancedAmount: 60000, avista: 0, parcela: 2500 },
    { downPaymentFinancedAmount: 30000, avista: 30000, parcela: 1250 },
  ])('limita o desembolso até a entrega com $downPaymentFinancedAmount parcelados', ({ downPaymentFinancedAmount, avista, parcela }) => {
    const r = calcularJurosDeObra({
      ...BASE,
      monthsUntilDelivery: 12,
      insuranceMonthly: 50,
      downPaymentFinancedAmount,
      downPaymentMonths: 24,
    });
    expect(r.totalEntrada).toBe(60000);
    expect(r.totalDuranteObra).toBeCloseTo(14802.51697794955 + 600 + avista + parcela * 12, 6);
    expect(r.monthly).toHaveLength(12);
    expect(r.monthly.every((m) => m.entradaParcela === parcela)).toBe(true);
  });

  it.each([
    { downPaymentParcela: 3000, downPaymentAvista: undefined, totalEntrada: 72000, ateEntrega: 36000 },
    { downPaymentParcela: 1000, downPaymentAvista: undefined, totalEntrada: 60000, ateEntrega: 48000 },
    { downPaymentParcela: 3000, downPaymentAvista: 10000, totalEntrada: 82000, ateEntrega: 46000 },
  ])('limita parcelas conhecidas à entrega, preservando entrada completa de $totalEntrada', ({ downPaymentParcela, downPaymentAvista, totalEntrada, ateEntrega }) => {
    const r = calcularJurosDeObra({
      ...BASE,
      annualRate: 0,
      monthsUntilDelivery: 12,
      downPaymentMonths: 24,
      downPaymentParcela,
      downPaymentAvista,
    });
    expect(r.totalEntrada).toBe(totalEntrada);
    expect(r.totalDuranteObra).toBe(ateEntrega);
  });

  it('inclui juros da entrada apenas nas parcelas pagas até a entrega', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      monthsUntilDelivery: 12,
      downPaymentFinancedAmount: 30000,
      downPaymentMonths: 24,
      downPaymentAnnualRate: 0.12,
    });
    expect(r.totalEntrada).toBeGreaterThan(60000);
    expect(r.totalDuranteObra).toBeCloseTo(30000 + r.monthly.reduce((sum, m) => sum + m.total, 0), 6);
    expect(r.totalEntrada - 30000).toBeCloseTo(r.monthly[0].entradaParcela * 24, 6);
  });

  it('entrada à vista: sem parcela mensal e total igual à entrada', () => {
    const r = calcularJurosDeObra(BASE);
    expect(r.monthly.every((m) => m.entradaParcela === 0)).toBe(true);
    expect(r.totalEntrada).toBe(60000);
    expect(r.totalDuranteObra).toBeCloseTo(r.totalJuros + r.totalSeguro + r.totalEntrada, 4);
  });

  it('entrada parcelada com parcela conhecida: usa o valor informado por mês', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      downPaymentFinancedAmount: 0,
      downPaymentParcela: 3000,
      downPaymentMonths: 12,
    });
    expect(r.monthly[0].entradaParcela).toBe(3000);
    expect(r.monthly[11].entradaParcela).toBe(3000);
    expect(r.monthly[12].entradaParcela).toBe(0);
    // entrada total de 60.000; parcelas somam 36.000; restante (24.000) à vista
    expect(r.totalEntrada).toBe(60000);
  });

  it('entrada parcelada com parcela conhecida acima da entrada: tudo parcelado', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      downPaymentFinancedAmount: 0,
      downPaymentParcela: 6000,
      downPaymentMonths: 12,
    });
    expect(r.totalEntrada).toBe(72000);
  });

  it('entrada parcelada com parcela conhecida e parte à vista informada', () => {
    const r = calcularJurosDeObra({
      ...BASE,
      downPaymentFinancedAmount: 0,
      downPaymentParcela: 4500,
      downPaymentAvista: 50000,
      downPaymentMonths: 12,
    });
    expect(r.monthly[0].entradaParcela).toBe(4500);
    // à vista 50.000 + 12 parcelas de 4.500 = 104.000 (com juros embutidos)
    expect(r.totalEntrada).toBe(104000);
  });

  it('rejeita entrada parcelada que não cobre o total informado', () => {
    expect(() =>
      calcularJurosDeObra({
        ...BASE,
        downPaymentFinancedAmount: 0,
        downPaymentParcela: 1000,
        downPaymentAvista: 10000,
        downPaymentMonths: 12,
      })
    ).toThrow();
  });

  it('rejeita valor parcelado acima da entrada', () => {
    expect(() =>
      calcularJurosDeObra({ ...BASE, downPaymentFinancedAmount: 60001, downPaymentMonths: 12 })
    ).toThrow();
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularJurosDeObra({ ...BASE, propertyValue: 0 })).toThrow();
    expect(() => calcularJurosDeObra({ ...BASE, downPaymentPct: 100 })).toThrow();
    expect(() => calcularJurosDeObra({ ...BASE, annualRate: -0.1 })).toThrow();
    expect(() => calcularJurosDeObra({ ...BASE, monthsUntilDelivery: 0 })).toThrow();
    expect(() => calcularJurosDeObra({ ...BASE, progressPct: 101 })).toThrow();
    expect(() => calcularJurosDeObra({ ...BASE, insuranceMonthly: -1 })).toThrow();
  });

  it.each<keyof ObraInput>([
    'propertyValue', 'downPaymentPct', 'annualRate', 'monthsUntilDelivery',
    'progressPct', 'insuranceMonthly', 'downPaymentFinancedAmount',
    'downPaymentMonths', 'downPaymentAnnualRate', 'downPaymentParcela', 'downPaymentAvista',
  ])('rejeita valores não finitos em %s', (field) => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => calcularJurosDeObra({ ...BASE, [field]: value })).toThrow();
    }
  });

  it.each(['monthsUntilDelivery', 'downPaymentMonths'] as const)('rejeita meses fracionários em %s', (field) => {
    expect(() => calcularJurosDeObra({ ...BASE, [field]: 1.5 })).toThrow();
  });

  it.each(['downPaymentAnnualRate', 'downPaymentParcela', 'downPaymentAvista'] as const)('rejeita valores negativos em %s', (field) => {
    expect(() => calcularJurosDeObra({ ...BASE, [field]: -1 })).toThrow();
  });

  it.each([
    { insuranceMonthly: 1e308 },
    { downPaymentParcela: 1e308, downPaymentAvista: 0 },
    { propertyValue: 1e308 },
  ])('rejeita overflow do resultado com entradas finitas: %j', (input) => {
    expect(() => calcularJurosDeObra({ ...BASE, ...input })).toThrow();
  });
});
