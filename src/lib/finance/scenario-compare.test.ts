import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScenarioCompare } from '@/components/simulation/ScenarioCompare';
import { simulate } from './engine';
import type { LoanInput } from './types';

describe('comparação usa os cenários apresentados', () => {
  it('base SAC mais barata vence PRICE com estratégia, sem recalcular um SAC oculto', () => {
    const input: LoanInput = {
      bank: 'Caixa', system: 'SAC', principal: 120000, annualRate: 1.01 ** 12 - 1,
      months: 60, trMonthly: 0, insuranceMonthly: 100,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    };
    const base = simulate(input);
    const current = simulate({ ...input, system: 'PRICE' }, { extraLumpSum: [], reduceMode: 'term', extraMonthlyPct: 0.05 });
    expect(base.metrics.totalPago).toBeCloseTo(162600, 2);
    expect(current.metrics.totalPago).toBeGreaterThan(base.metrics.totalPago);
    const html = renderToStaticMarkup(createElement(ScenarioCompare, { base, current }));
    expect(html).toContain('Melhor caminho: cenário sem estratégia');
  });
});
