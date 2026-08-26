import { describe, expect, it } from 'vitest';
import { recommend } from './recommend';
import { simulate } from './engine';
import type { LoanInput, Strategies } from './types';

const input: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const base: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('recommend', () => {
  it('escolhe cenário com menor total pago', () => {
    const agressivo = { ...base, extraMonthlyPct: 0.10 };
    const r = recommend(input, [base, agressivo]);
    expect(r.best.metrics.totalPago).toBeLessThan(simulate(input, base).metrics.totalPago);
  });
  it('devolve todos os cenários avaliados', () => {
    const r = recommend(input, [base]);
    expect(r.scenarios).toHaveLength(1);
  });
});
