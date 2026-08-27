import { describe, expect, it } from 'vitest';
import { maxFinancing, recommendSmart, type SmartInput } from './smart';
import { simulate } from './engine';
import type { LoanInput } from './types';

const base: SmartInput = {
  principal: 1000000, annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, bank: 'Caixa', maxPayment: 12000, maxMonths: 360,
};

describe('maxFinancing (cálculo inverso)', () => {
  const input = { maxPayment: 5000, annualRate: 0.105, trMonthly: 0.0017, insuranceMonthly: 100, bank: 'Caixa', months: 360 };
  it('com R$5.000/mês financia ~R$557k no PRICE e ~R$440k no SAC', () => {
    const r = maxFinancing(input);
    expect(r.PRICE).toBeGreaterThan(550000);
    expect(r.PRICE).toBeLessThan(565000);
    expect(r.SAC).toBeGreaterThan(435000);
    expect(r.SAC).toBeLessThan(445000);
    expect(r.PRICE).toBeGreaterThan(r.SAC);
  });
  it('a parcela do valor encontrado cabe no orçamento', () => {
    const r = maxFinancing(input);
    for (const [system, principal] of [
      ['PRICE', r.PRICE],
      ['SAC', r.SAC],
    ] as const) {
      const res = simulate(
        { system, principal, annualRate: input.annualRate, months: input.months, trMonthly: input.trMonthly, insuranceMonthly: input.insuranceMonthly, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa' },
        { extraLumpSum: [], reduceMode: 'term' }
      );
      expect(res.installments[0].parcela).toBeLessThanOrEqual(input.maxPayment + 1);
    }
  });
});

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
  it('maxTerms mostra ambos os sistemas viáveis no prazo máximo', () => {
    const r = recommendSmart({ ...base, maxPayment: 11000 });
    expect(r.maxTerms.length).toBeGreaterThan(0);
    for (const t of r.maxTerms) {
      expect(t.months).toBe(360);
      expect(t.result.metrics.totalPago).toBeGreaterThanOrEqual(r.best!.result.metrics.totalPago);
    }
  });
  it('aporte limitado a +100% da parcela (orçamento absurdamente alto)', () => {
    const r = recommendSmart({ ...base, maxPayment: 100000 });
    const b = r.best!;
    expect(b.extraMonthlyPct).toBeLessThanOrEqual(1);
    expect(b.months).toBeGreaterThanOrEqual(60);
  });
  it('pagamento fixo: todo mês paga exatamente o orçamento', () => {
    const r = recommendSmart({ ...base, maxPayment: 12000 });
    const b = r.best!;
    for (const i of b.result.installments.slice(0, 12)) {
      expect(i.parcela).toBeCloseTo(12000, 1);
    }
  });
  it('pagamento fixo só até o mês X: depois volta à parcela', () => {
    const r = recommendSmart({ ...base, maxPayment: 12000, fixedUntilMonth: 12 });
    const b = r.best!;
    expect(b.result.installments[0].parcela).toBeCloseTo(12000, 1);
    expect(b.result.installments[12].parcela).toBeLessThan(12000);
  });
  it('avalia os dois modos e escolhe o melhor (best = menor total)', () => {
    const r = recommendSmart(base);
    expect(r.modes.term).not.toBeNull();
    expect(r.modes.payment).not.toBeNull();
    expect(r.modes.term!.result.strategies.reduceMode).toBe('term');
    expect(r.modes.payment!.result.strategies.reduceMode).toBe('payment');
    const menor = Math.min(
      r.modes.term!.result.metrics.totalPago,
      r.modes.payment!.result.metrics.totalPago
    );
    expect(r.best!.result.metrics.totalPago).toBe(menor);
  });
  it('fixedPayment=false usa percentual extra (aporte cresce com a parcela)', () => {
    const r = recommendSmart({ ...base, maxPayment: 12000, fixedPayment: false });
    const b = r.best!;
    const p1 = b.result.installments[0].parcela;
    const p24 = b.result.installments[23]?.parcela ?? p1;
    expect(p24).toBeGreaterThan(p1);
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
