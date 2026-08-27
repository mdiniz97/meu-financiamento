import { describe, expect, it } from 'vitest';
import { priceBreakEven } from './insights';
import { simulate } from './engine';
import type { LoanInput } from './types';

const base: LoanInput = {
  system: 'PRICE', principal: 1000000, annualRate: 0.105, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const noStrategy = { extraLumpSum: [], reduceMode: 'term' as const };

describe('priceBreakEven', () => {
  it('1M/360: parcela mínima ~R$ 10.255 e prazo máximo ~213 meses', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(b.minPayment).toBeCloseTo(10155.16, 2);
    expect(b.maxMonths).toBe(213);
    expect(b.monthsUntilAmortize).toBe(148);
  });
  it('prazo curto abate a dívida desde o mês 1', () => {
    const curto = { ...base, months: 100 };
    const r = simulate(curto, noStrategy);
    const b = priceBreakEven(curto, r);
    expect(b.monthsUntilAmortize).toBe(1);
    expect(b.maxMonths).toBe(213);
  });
  it('sem TR não há limite de prazo e a dívida abate no mês 1', () => {
    const semTr = { ...base, trMonthly: 0 };
    const r = simulate(semTr, noStrategy);
    const b = priceBreakEven(semTr, r);
    expect(b.maxMonths).toBe(Infinity);
    expect(b.monthsUntilAmortize).toBe(1);
  });
  it('parcela contratual abaixo da mínima indica dívida crescendo no início', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(r.installments[0].parcela).toBeLessThan(b.minPayment);
  });
  it('parcela se financiar já no prazo ideal (213 meses): ~R$ 10.165,84', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(b.idealPayment).toBeCloseTo(10165.84, 2);
    expect(b.idealPayment!).toBeGreaterThan(b.minPayment);
  });
  it('sem TR não há parcela ideal (prazo ilimitado)', () => {
    const semTr = { ...base, trMonthly: 0 };
    const b = priceBreakEven(semTr);
    expect(b.idealPayment).toBeNull();
  });
});
