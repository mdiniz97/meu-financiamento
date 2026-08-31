import { describe, expect, it } from 'vitest';
import { isRateKind, normalizeRate } from './rates';

describe('normalizeRate', () => {
  it('normaliza taxa efetiva anual', () => {
    expect(normalizeRate(10.5, 'effective-annual')).toEqual({
      effectiveAnnual: 0.105,
      effectiveMonthly: expect.closeTo(1.105 ** (1 / 12) - 1, 12),
    });
  });

  it('converte taxa nominal anual usando nominal/12', () => {
    const result = normalizeRate(12, 'nominal-annual');
    expect(result.effectiveMonthly).toBeCloseTo(0.01, 12);
    expect(result.effectiveAnnual).toBeCloseTo(1.01 ** 12 - 1, 12);
  });

  it('converte taxa efetiva mensal', () => {
    const result = normalizeRate(1, 'effective-monthly');
    expect(result.effectiveMonthly).toBeCloseTo(0.01, 12);
    expect(result.effectiveAnnual).toBeCloseTo(1.01 ** 12 - 1, 12);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejeita %s', (percent) => {
    expect(() => normalizeRate(percent, 'effective-annual')).toThrow(/taxa/i);
  });

  it('rejeita tipo de taxa desconhecido em runtime', () => {
    expect(isRateKind('monthly')).toBe(false);
    expect(() => normalizeRate(1, 'monthly' as never)).toThrow(/tipo de taxa/i);
  });
});
