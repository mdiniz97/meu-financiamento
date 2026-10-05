import { describe, expect, it } from 'vitest';
import { evaluateNegotiation } from './negotiation';

const base = {
  system: 'PRICE' as const,
  principal: 300000,
  propertyValue: 400000,
  annualRate: 0.10,
  months: 360,
  trMonthly: 0,
  insuranceMonthly: 0,
  bank: 'Caixa',
  maxPayment: 3000,
};

const peakOf = (rate: number, months: number) =>
  evaluateNegotiation({ ...base, annualRate: rate, months }).peakPayment;

describe('evaluateNegotiation', () => {
  it('marca fits e folga quando o pico cabe no teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.fits).toBe(true);
    expect(r.peakPayment).toBeLessThanOrEqual(base.maxPayment + 0.01);
    expect(r.slackMonthly).toBeCloseTo(base.maxPayment - r.peakPayment, 2);
  });
  it('fits=false e slack 0 quando nem a 0% cabe', () => {
    const r = evaluateNegotiation({ ...base, maxPayment: 500 });
    expect(r.fits).toBe(false);
    expect(r.slackMonthly).toBe(0);
    expect(r.maxAnnualRate).toBeNull();
  });
  it('maxAnnualRate é a maior taxa em que o pico ~ teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxAnnualRate).not.toBeNull();
    expect(peakOf(r.maxAnnualRate!, base.months)).toBeLessThanOrEqual(base.maxPayment + 0.5);
    expect(peakOf(r.maxAnnualRate! + 0.001, base.months)).toBeGreaterThan(base.maxPayment);
  });
  it('minMonths é o menor prazo em que o pico cabe', () => {
    const r = evaluateNegotiation(base);
    expect(peakOf(base.annualRate, r.minMonths)).toBeLessThanOrEqual(base.maxPayment + 0.01);
    if (r.minMonths > 1) {
      expect(peakOf(base.annualRate, r.minMonths - 1)).toBeGreaterThan(base.maxPayment);
    }
  });
  it('maxPrincipal tem pico <= teto e minDownPayment = valor - maxPrincipal', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxPrincipal).toBeGreaterThan(0);
    expect(r.minDownPayment).toBeCloseTo(base.propertyValue - r.maxPrincipal, 2);
    expect(r.maxPropertyValue).toBeCloseTo(r.maxPrincipal + (base.propertyValue - base.principal), 2);
  });
  it('SAC e PRICE retornam limites coerentes (sem NaN/infinito)', () => {
    for (const system of ['PRICE', 'SAC'] as const) {
      const r = evaluateNegotiation({ ...base, system });
      expect(Number.isFinite(r.peakPayment)).toBe(true);
      expect(Number.isFinite(r.maxPrincipal)).toBe(true);
      expect(r.minDownPayment).toBeGreaterThanOrEqual(0);
    }
  });
  it('lança erro para entrada inválida', () => {
    expect(() => evaluateNegotiation({ ...base, months: 0 })).toThrow();
  });
});
