import { describe, expect, it } from 'vitest';
import { evaluateNegotiation } from './negotiation';

const base = {
  system: 'PRICE' as const,
  principal: 300000,
  annualRate: 0.10,
  months: 360,
  trMonthly: 0,
  insuranceMonthly: 0,
  bank: 'Caixa',
  maxPayment: 3000,
};

const firstOf = (over: Partial<typeof base>) =>
  evaluateNegotiation({ ...base, ...over }).initialPayment;

describe('evaluateNegotiation (critério: 1ª parcela <= teto)', () => {
  it('fits quando a 1ª parcela cabe no teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.fits).toBe(true);
    expect(r.initialPayment).toBeLessThanOrEqual(base.maxPayment + 0.01);
    expect(r.slackMonthly).toBeCloseTo(base.maxPayment - r.initialPayment, 2);
  });
  it('cabe mesmo com pico (TR) bem acima do teto', () => {
    const r = evaluateNegotiation({ ...base, trMonthly: 0.0017, maxPayment: 3200 });
    expect(r.fits).toBe(true);
    expect(r.peakPayment).toBeGreaterThan(base.maxPayment);
  });
  it('não cabe quando nem a 0% a 1ª parcela entra', () => {
    const r = evaluateNegotiation({ ...base, maxPayment: 500 });
    expect(r.fits).toBe(false);
    expect(r.slackMonthly).toBe(0);
    expect(r.maxAnnualRate).toBeNull();
  });
  it('maxAnnualRate é a maior taxa com 1ª parcela ~ teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxAnnualRate).not.toBeNull();
    expect(firstOf({ annualRate: r.maxAnnualRate! })).toBeLessThanOrEqual(base.maxPayment + 0.5);
    expect(firstOf({ annualRate: r.maxAnnualRate! + 0.001 })).toBeGreaterThan(base.maxPayment);
  });
  it('minMonths é o menor prazo com 1ª parcela <= teto', () => {
    const r = evaluateNegotiation(base);
    expect(firstOf({ months: r.minMonths })).toBeLessThanOrEqual(base.maxPayment + 0.01);
    if (r.minMonths > 1) {
      expect(firstOf({ months: r.minMonths - 1 })).toBeGreaterThan(base.maxPayment);
    }
  });
  it('maxPrincipal tem 1ª parcela <= teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxPrincipal).toBeGreaterThan(0);
    expect(evaluateNegotiation({ ...base, principal: r.maxPrincipal }).initialPayment).toBeLessThanOrEqual(base.maxPayment + 0.5);
  });
  it('SAC e PRICE retornam limites coerentes (sem NaN/infinito)', () => {
    for (const system of ['PRICE', 'SAC'] as const) {
      const r = evaluateNegotiation({ ...base, system });
      expect(Number.isFinite(r.initialPayment)).toBe(true);
      expect(Number.isFinite(r.maxPrincipal)).toBe(true);
    }
  });
  it('lança erro para entrada inválida', () => {
    expect(() => evaluateNegotiation({ ...base, months: 0 })).toThrow();
  });
});
