import { describe, expect, it } from 'vitest';
import { serializeComparisonInput, deserializeComparisonInput } from './actions';

const input = {
  monthlyBudget: 12000,
  proposals: [
    { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000, system: 'SAC' as const, months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
    { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, principal: 620000, system: 'PRICE' as const, months: 360, annualRate: 0.092, cetInformed: 0.116, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
  ],
};

describe('serialize/deserialize comparação', () => {
  it('round-trip preserva entradas', () => {
    const raw = serializeComparisonInput(input);
    expect(raw).toContain('"version":1');
    const back = deserializeComparisonInput(raw);
    expect(back.monthlyBudget).toBe(12000);
    expect(back.proposals).toHaveLength(2);
    expect(back.proposals[0].bank).toBe('Caixa');
    expect(back.proposals[0].principal).toBe(600000);
  });
  it('rejeita JSON com schema inválido', () => {
    expect(() => deserializeComparisonInput('{"version":1,"proposals":[{"id":"x"}]}')).toThrow();
  });
  it('rejeita mais de 3 propostas', () => {
    const bad = { ...input, proposals: [...input.proposals, input.proposals[0], input.proposals[0]] };
    expect(() => serializeComparisonInput(bad)).toThrow();
  });
});
