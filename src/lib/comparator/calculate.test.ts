import { describe, expect, it } from 'vitest';
import { computeComparator } from './calculate';
import type { ComparatorInput } from './types';

function input(): ComparatorInput {
  return {
    monthlyBudget: 12000,
    proposals: [
      { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000, system: 'SAC', months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
      { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, principal: 620000, system: 'PRICE', months: 360, annualRate: 0.092, cetInformed: 0.116, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
    ],
  };
}

describe('computeComparator', () => {
  it('calcula custo da aquisição com entrada, total pago e tarifas', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    expect(p1.acquisitionCost).toBeCloseTo(250000 + p1.result.metrics.totalPago + 1500, 6);
  });
  it('custo por 100 mil usa financingCost sem entrada', () => {
    const { ranked } = computeComparator(input()).v1;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(p2.costPer100k).toBeCloseTo((p2.result.metrics.totalPago) / 620000 * 100000, 6);
  });
  it('CET calculado considera tarifa incluída no crédito líquido', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(Math.abs(p1.cetCalculated - p1.proposal.annualRate) < 0.03).toBe(true);
    expect(Math.abs(p2.cetCalculated - p2.proposal.annualRate) < 0.03).toBe(true);
    expect(p1.cetCalculated).toBeGreaterThan(p2.cetCalculated);
  });
  it('alerta quando CET informado difere do calculado na 2ª casa', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    expect(p1.cetAlert).toBe(true);
  });
  it('não alerta quando informado ≈ calculado', () => {
    const { ranked } = computeComparator(input()).v1;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(p2.cetAlert).toBe(false);
  });
  it('ranqueia por menor custo total da aquisição', () => {
    const { ranked, best } = computeComparator(input()).v1;
    expect(best!.proposal.id).toBe(ranked[0].proposal.id);
    expect(ranked[0].acquisitionCost <= ranked[1].acquisitionCost).toBe(true);
  });
  it('smart viável gera recomendação; inviável marca feasible false', () => {
    const cheap = { ...input(), monthlyBudget: 3000 };
    const { outcomes } = computeComparator(cheap).v1;
    for (const o of outcomes) {
      expect(typeof o.smart!.feasible).toBe('boolean');
      if (!o.smart!.feasible) expect(o.smart!.minBudget).toBeGreaterThan(0);
    }
  });
  it('lança para entrada inválida', () => {
    const bad = input();
    bad.proposals[0].months = 0;
    expect(() => computeComparator(bad)).toThrow();
  });

  it('restaura banco legado em todos os resultados retornados e serializados', () => {
    const legacy = input();
    const originalBank = 'Banco legado '.repeat(8).trim();
    legacy.proposals[0].bank = originalBank;

    const result = computeComparator(legacy, { legacy: true });
    const outcome = result.v1.outcomes.find((item) => item.proposal.id === 'p1')!;
    const simulationResults = [
      outcome.result,
      ...outcome.smart!.recommended.alternatives.map((candidate) => candidate.result),
      ...outcome.smart!.recommended.comparison.flatMap((comparison) => comparison.candidate ? [comparison.candidate.result] : []),
      ...Object.values(outcome.smart!.recommended.modes).flatMap((candidate) => candidate ? [candidate.result] : []),
      ...outcome.smart!.recommended.maxTerms.map((candidate) => candidate.result),
    ];

    expect(simulationResults.length).toBeGreaterThan(1);
    expect(simulationResults.every((simulation) => simulation.input.bank === originalBank)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('"bank":"Banco legado"');
    expect(legacy.proposals[0].bank).toBe(originalBank);
  });
});
