import { describe, expect, it } from 'vitest';
import { normalizeProposal, validateComparator, assertAtMostThree, ComparatorValidationError } from './validate';
import type { ComparatorInput } from './types';

const ok = (): ComparatorInput => ({
  monthlyBudget: 12000,
  proposals: [
    { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000, system: 'SAC', months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
    { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, principal: 620000, system: 'PRICE', months: 360, annualRate: 0.092, cetInformed: 0.0994, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
  ],
});

describe('normalizeProposal', () => {
  it('calcula valor financiado automático (imóvel − entrada)', () => {
    const p = normalizeProposal(ok().proposals[0] as unknown as Record<string, unknown>);
    expect(p.principal).toBe(600000);
  });
  it('usa principalManual quando presente', () => {
    const raw = { ...ok().proposals[0], principalManual: 610000 } as unknown as Record<string, unknown>;
    expect(normalizeProposal(raw).principal).toBe(610000);
  });
  it('lança erro para prazo fora de 1–600', () => {
    const raw = { ...ok().proposals[0], months: 0 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro quando entrada >= imóvel', () => {
    const raw = { ...ok().proposals[0], downPayment: 850000 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro para taxa acima de 100%', () => {
    const raw = { ...ok().proposals[0], annualRate: 1.2 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
});

describe('validateComparator', () => {
  it('retorna vazio para entrada válida', () => {
    expect(validateComparator(ok())).toEqual([]);
  });
  it('sinaliza proposta com erro sem derrubar as outras', () => {
    const input = ok();
    input.proposals[1].months = 0;
    const errors = validateComparator(input);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe('p2');
  });
  it('exige entre 2 e 3 propostas', () => {
    const one = { ...ok(), proposals: ok().proposals.slice(0, 1) };
    expect(validateComparator(one).some((e) => e.message.includes('2'))).toBe(true);
  });
  it('exige orçamento maior que zero', () => {
    const input = ok();
    input.monthlyBudget = 0;
    expect(validateComparator(input).some((e) => e.message.includes('orçamento'))).toBe(true);
  });
});

describe('assertAtMostThree', () => {
  it('lança acima de 3 propostas', () => {
    expect(() => assertAtMostThree([1, 2, 3, 4])).toThrow(/3/);
  });
});
