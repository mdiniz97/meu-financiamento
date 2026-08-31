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
    const raw = { ...ok().proposals[0], principal: 610000, principalManual: true } as unknown as Record<string, unknown>;
    expect(normalizeProposal(raw).principal).toBe(610000);
    expect(normalizeProposal(raw).principalManual).toBe(true);
  });
  it('lança erro para prazo fora de 1–600', () => {
    const raw = { ...ok().proposals[0], months: 0 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro para prazo fracionário', () => {
    const raw = { ...ok().proposals[0], months: 360.5 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(/prazo/i);
  });
  it('lança erro quando entrada >= imóvel', () => {
    const raw = { ...ok().proposals[0], downPayment: 850000 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro para taxa acima de 100%', () => {
    const raw = { ...ok().proposals[0], annualRate: 1.2 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('alinha TR ao máximo de 10% do engine', () => {
    const raw = { ...ok().proposals[0], trMonthly: 0.11 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(/TR/i);
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

  it('rejeita IDs de proposta duplicados ou inseguros', () => {
    const duplicated = ok();
    duplicated.proposals[1].id = duplicated.proposals[0].id;
    expect(validateComparator(duplicated).some((e) => /identificador/i.test(e.message))).toBe(true);
    const unsafe = ok();
    unsafe.proposals[0].id = 'p 1/<script>';
    expect(validateComparator(unsafe).some((e) => /identificador/i.test(e.message))).toBe(true);
  });
});

describe('assertAtMostThree', () => {
  it('lança acima de 3 propostas', () => {
    expect(() => assertAtMostThree([1, 2, 3, 4])).toThrow(/3/);
  });
});

describe('limites de payload', () => {
  it('rejeita mais de 20 tarifas antes do cálculo', () => {
    const raw = { ...ok().proposals[0], fees: Array.from({ length: 21 }, (_, i) => ({ id: `f${i}`, label: 'Tarifa', amount: 1, includeInCet: false })) };
    expect(() => normalizeProposal(raw as unknown as Record<string, unknown>)).toThrow(/20 tarifas/);
  });

  it.each(['bank', 'name'] as const)('rejeita %s acima de 100 caracteres', (field) => {
    const raw = { ...ok().proposals[0], [field]: 'x'.repeat(101) };
    expect(() => normalizeProposal(raw as unknown as Record<string, unknown>)).toThrow(/100 caracteres/);
  });

  it('rejeita label de tarifa acima de 100 caracteres', () => {
    const raw = { ...ok().proposals[0], fees: [{ id: 'f1', label: 'x'.repeat(101), amount: 1, includeInCet: false }] };
    expect(() => normalizeProposal(raw as unknown as Record<string, unknown>)).toThrow(/100 caracteres/);
  });

  it('rejeita IDs de tarifa duplicados ou inseguros', () => {
    const duplicateFees = { ...ok().proposals[0], fees: [
      { id: 'f1', label: 'A', amount: 1, includeInCet: false },
      { id: 'f1', label: 'B', amount: 2, includeInCet: true },
    ] };
    expect(() => normalizeProposal(duplicateFees as unknown as Record<string, unknown>)).toThrow(/identificador/i);
    const unsafeFee = { ...ok().proposals[0], fees: [{ id: 'f 1', label: 'A', amount: 1, includeInCet: false }] };
    expect(() => normalizeProposal(unsafeFee as unknown as Record<string, unknown>)).toThrow(/identificador/i);
  });

  it('rejeita includeInCet que não seja boolean', () => {
    const raw = { ...ok().proposals[0], fees: [{ id: 'f1', label: 'A', amount: 1, includeInCet: 'false' }] };
    expect(() => normalizeProposal(raw as unknown as Record<string, unknown>)).toThrow(/includeInCet/i);
  });

  it.each([
    ['bank', {}],
    ['bank', []],
    ['bank', null],
    ['name', {}],
    ['name', []],
  ])('rejeita %s malformado sem coerção', (field, value) => {
    const raw = { ...ok().proposals[0], [field]: value };
    expect(() => normalizeProposal(raw as unknown as Record<string, unknown>)).toThrow(/inválido/);
  });
});
