import { describe, expect, it } from 'vitest';
import { convertAnnualToMonthly, irrMonthly, pmt } from './engine';

describe('engine formulas', () => {
  it('converte taxa anual para mensal efetiva', () => {
    expect(convertAnnualToMonthly(0.10)).toBeCloseTo(0.007974140428903764, 12);
  });
  it('calcula PMT (parcela constante)', () => {
    expect(pmt(0.007974140428903764, 100, 100000)).toBeCloseTo(1454.9210468803736, 6);
  });
  it('calcula IRR mensal', () => {
    const flow = [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1100];
    expect(irrMonthly(flow)).toBeCloseTo(0.1, 6);
  });
});
