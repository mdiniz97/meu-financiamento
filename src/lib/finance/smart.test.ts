import { describe, expect, it } from 'vitest';
import { recommendSmart, type SmartInput } from './smart';
import { simulate } from './engine';
import type { LoanInput } from './types';

const base: SmartInput = {
  principal: 1000000, annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, bank: 'Caixa', maxPayment: 12000, maxMonths: 360,
};

describe('recommendSmart', () => {
  it('com orçamento de R$12k encontra um cenário viável com total menor que os bases', () => {
    const r = recommendSmart(base);
    expect(r.infeasible).toBe(false);
    expect(r.best).not.toBeNull();
    const b = r.best!;
    expect(b.parcela + b.extraMonthlyAmount).toBeLessThanOrEqual(12000);
    const priceBase = simulate({ ...toInput(base), system: 'PRICE' }, { extraLumpSum: [], reduceMode: 'term' });
    const sacBase = simulate({ ...toInput(base), system: 'SAC' }, { extraLumpSum: [], reduceMode: 'term' });
    expect(b.result.metrics.totalPago).toBeLessThan(Math.min(priceBase.metrics.totalPago, sacBase.metrics.totalPago));
  });
  it('usa todo o orçamento como parcela + aporte', () => {
    const r = recommendSmart({ ...base, maxPayment: 12000 });
    const b = r.best!;
    expect(b.extraMonthlyAmount).toBeCloseTo(12000 - b.parcela, 1);
  });
  it('orçamento baixo demais → infeasible com orçamento mínimo', () => {
    const r = recommendSmart({ ...base, maxPayment: 5000 });
    expect(r.infeasible).toBe(true);
    expect(r.best).toBeNull();
    expect(r.minBudget).toBeGreaterThan(5000);
  });
  it('prazo máximo curto inviabiliza o SAC e recomenda PRICE', () => {
    const r = recommendSmart({ ...base, maxPayment: 12000, maxMonths: 180 });
    expect(r.infeasible).toBe(false);
    expect(r.best!.system).toBe('PRICE');
    const sac = r.comparison.find((c) => c.system === 'SAC')!;
    expect(sac.feasible).toBe(false);
    expect(sac.minParcela).toBeGreaterThan(12000);
  });
  it('comparação sempre traz os dois sistemas', () => {
    const r = recommendSmart(base);
    expect(r.comparison.map((c) => c.system)).toEqual(['PRICE', 'SAC']);
    expect(r.comparison.every((c) => c.feasible)).toBe(true);
    expect(r.comparison.every((c) => c.candidate)).toBeTruthy();
  });
  it('maxTerm mostra o melhor sistema já no prazo máximo', () => {
    const r = recommendSmart({ ...base, maxPayment: 11000 });
    expect(r.maxTerm).not.toBeNull();
    expect(r.maxTerm!.system).toBe(r.best!.system);
    expect(r.maxTerm!.months).toBe(360);
    expect(r.maxTerm!.result.metrics.totalPago).toBeGreaterThanOrEqual(r.best!.result.metrics.totalPago);
  });
  it('aporte limitado a +100% da parcela (orçamento absurdamente alto)', () => {
    const r = recommendSmart({ ...base, maxPayment: 100000 });
    const b = r.best!;
    expect(b.extraMonthlyPct).toBeLessThanOrEqual(1);
    expect(b.months).toBeGreaterThanOrEqual(60);
  });
});

function toInput(s: SmartInput): LoanInput {
  return {
    system: 'PRICE', principal: s.principal, annualRate: s.annualRate,
    months: s.maxMonths ?? 360, trMonthly: s.trMonthly,
    insuranceMonthly: s.insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: s.bank,
  };
}
