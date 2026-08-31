import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import { calculateFinancingCapacity, calculatePeakPayment } from './financing-capacity';

const base = {
  maxPayment: 5000,
  annualRate: 0.105,
  trMonthly: 0.0017,
  insuranceMonthly: 100,
  bank: 'Caixa',
  months: 360,
};

const capacityCases = [120, 240, 360].flatMap((months) =>
  [0, 0.0017, 0.003].flatMap((trMonthly) =>
    [0, 0.05, 0.105].map((annualRate) => ({ months, trMonthly, annualRate }))
  )
);

describe('calculateFinancingCapacity', () => {
  it('retorna máximo inicial e seguro sem ultrapassar teto', () => {
    const result = calculateFinancingCapacity(base);
    for (const system of ['PRICE', 'SAC'] as const) {
      expect(result[system].initialLimit).toBeGreaterThanOrEqual(result[system].safeLimit);
      expect(result[system].initialPayment).toBeLessThanOrEqual(base.maxPayment + 0.01);
      expect(result[system].peakPayment).toBeLessThanOrEqual(base.maxPayment + 0.01);
      expect(result[system].peakPaymentMonth).toBeGreaterThanOrEqual(1);
    }
  });

  it('TR pode tornar máximo seguro menor que máximo inicial', () => {
    const result = calculateFinancingCapacity({ ...base, trMonthly: 0.003 });
    expect(result.PRICE.safeLimit).toBeLessThan(result.PRICE.initialLimit);
  });

  it('retorna zero quando custo fixo já consome a parcela máxima', () => {
    const result = calculateFinancingCapacity({ ...base, maxPayment: 50, insuranceMonthly: 100 });
    expect(result.PRICE).toEqual({
      initialLimit: 0,
      safeLimit: 0,
      initialPayment: 0,
      peakPayment: 0,
      peakPaymentMonth: 0,
    });
    expect(result.SAC.safeLimit).toBe(0);
  });

  it.each([
    ['maxPayment', Number.NaN], ['maxPayment', 0], ['annualRate', -0.01], ['annualRate', 1.01],
    ['trMonthly', -0.01], ['trMonthly', 0.11], ['insuranceMonthly', -1], ['months', 0],
    ['months', 601], ['months', 12.5], ['bank', ''], ['bank', 'x'.repeat(61)],
  ] as const)('rejeita input inválido %s=%s', (field, value) => {
    expect(() => calculateFinancingCapacity({ ...base, [field]: value })).toThrow(/inválido/i);
  });

  it('PRICE com taxa zero e TR retorna pagamentos finitos', () => {
    const result = calculateFinancingCapacity({ ...base, annualRate: 0 });
    expect(Number.isFinite(result.PRICE.initialPayment)).toBe(true);
    expect(Number.isFinite(result.PRICE.peakPayment)).toBe(true);
    expect(result.PRICE.peakPayment).toBeLessThanOrEqual(base.maxPayment);
  });

  it('pico é monotônico em grade de principal para PRICE/SAC, taxas e TR', () => {
    for (const system of ['PRICE', 'SAC'] as const) {
      for (const annualRate of [0, 0.05, 0.105]) {
        for (const trMonthly of [0, 0.0017, 0.003]) {
          let previous = 0;
          for (const principal of [10000, 50000, 100000, 250000]) {
            const current = calculatePeakPayment({ ...base, annualRate, trMonthly }, principal, system).peakPayment;
            expect(current).toBeGreaterThanOrEqual(previous);
            previous = current;
          }
        }
      }
    }
  });

  it('trata principal não amortizante como inseguro', () => {
    expect(calculatePeakPayment({ ...base, annualRate: 0, trMonthly: 0.01, months: 600 }, 300000, 'PRICE').peakPayment).toBe(Infinity);
  });

  it('retorna máximo em centavos dentro de epsilon exato', () => {
    const result = calculateFinancingCapacity(base);
    for (const system of ['PRICE', 'SAC'] as const) {
      expect(result[system].peakPayment).toBeLessThanOrEqual(base.maxPayment);
      const next = simulate({
        system, principal: result[system].safeLimit + 0.01, annualRate: base.annualRate,
        trMonthly: base.trMonthly, insuranceMonthly: base.insuranceMonthly,
        insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: base.bank, months: base.months,
      });
      expect(Math.max(...next.installments.map((item) => item.parcela))).toBeGreaterThan(base.maxPayment);
    }
  });

  it('não perde centavos por usar upper inteiro truncado', () => {
    const result = calculateFinancingCapacity({ ...base, trMonthly: 0, maxPayment: 1234.56 });
    for (const system of ['PRICE', 'SAC'] as const) {
      expect(result[system].safeLimit).toBeGreaterThan(0);
      expect(calculatePeakPayment({ ...base, trMonthly: 0, maxPayment: 1234.56 }, result[system].safeLimit + 0.01, system).peakPayment).toBeGreaterThan(1234.56);
    }
  });

  it('limita principal ao teto do engine quando R$ 1 tri ainda é seguro', () => {
    const result = calculateFinancingCapacity({ ...base, maxPayment: 1_000_000_000_000, annualRate: 0, trMonthly: 0, insuranceMonthly: 0, months: 600 });
    expect(result.PRICE.safeLimit).toBe(1_000_000_000_000);
    expect(result.SAC.safeLimit).toBe(1_000_000_000_000);
  });

  it('arredonda máximo seguro para centavos e mantém todas as parcelas no teto', () => {
    const result = calculateFinancingCapacity(base);
    for (const system of ['PRICE', 'SAC'] as const) {
      expect(result[system].safeLimit * 100).toBeCloseTo(Math.round(result[system].safeLimit * 100), 8);
      const simulation = simulate({
        system,
        principal: result[system].safeLimit,
        annualRate: base.annualRate,
        trMonthly: base.trMonthly,
        insuranceMonthly: base.insuranceMonthly,
        insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
        bank: base.bank,
        months: base.months,
      });
      expect(Math.max(...simulation.installments.map((item) => item.parcela))).toBeLessThanOrEqual(base.maxPayment + 0.01);
    }
  });

  it.each(capacityCases)(
    'é seguro e maximal em centavos para prazo $months, TR $trMonthly e taxa $annualRate',
    ({ months, trMonthly, annualRate }) => {
      const input = { ...base, months, trMonthly, annualRate };
      const result = calculateFinancingCapacity(input);

      for (const system of ['PRICE', 'SAC'] as const) {
        const safeLimit = result[system].safeLimit;
        const nonAmortizingPlateau = system === 'PRICE' && annualRate === 0 && 1 / months <= trMonthly;

        if (nonAmortizingPlateau) {
          // PRICE at zero interest cannot cover TR when scheduled amortization is no larger than correction.
          expect(1 / months).toBeLessThanOrEqual(trMonthly);
          expect(safeLimit).toBe(0);
          expect(() => simulate({
            system,
            principal: 0.01,
            annualRate,
            trMonthly,
            insuranceMonthly: input.insuranceMonthly,
            insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
            bank: input.bank,
            months,
          })).toThrow(/contrato não amortiza: parcela programada não cobre a correção monetária/i);
          continue;
        }

        expect(safeLimit).toBeGreaterThan(0);
        const safe = simulate({
          system,
          principal: safeLimit,
          annualRate,
          trMonthly,
          insuranceMonthly: input.insuranceMonthly,
          insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
          bank: input.bank,
          months,
        });
        expect(safe.installments.length).toBeGreaterThan(0);
        expect(safe.installments.every(({ parcela }) =>
          Number.isFinite(parcela) && parcela <= input.maxPayment + 1e-7
        )).toBe(true);
        expect(safe.installments.at(-1)?.saldo).toBeLessThanOrEqual(0.005);

        if (safeLimit === 1_000_000_000_000) continue;
        const next = simulate({
          system,
          principal: safeLimit + 0.01,
          annualRate,
          trMonthly,
          insuranceMonthly: input.insuranceMonthly,
          insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
          bank: input.bank,
          months,
        });
        expect(next.installments.length).toBeGreaterThan(0);
        expect(next.installments.every(({ parcela }) => Number.isFinite(parcela))).toBe(true);
        expect(next.installments.at(-1)?.saldo).toBeLessThanOrEqual(0.005);
        expect(Math.max(...next.installments.map(({ parcela }) => parcela))).toBeGreaterThan(input.maxPayment);
      }
    }
  );
});
