import { describe, expect, it } from 'vitest';
import { comparePortability, portabilityBreakEven, type PortabilityInput } from './portability';

const base: PortabilityInput = {
  principal: 800000, currentSystem: 'PRICE', currentAnnualRate: 0.115,
  trMonthly: 0.0017, insuranceMonthly: 100, months: 300, bank: 'Caixa',
  newAnnualRate: 0.09, newSystem: 'PRICE', newInsuranceMonthly: 100, newBank: 'Itaú',
};

describe('comparePortability', () => {
  it('taxa menor → portar economiza e parcela cai', () => {
    const r = comparePortability(base);
    expect(r.economia).toBeGreaterThan(0);
    expect(r.ported.installments[0].parcela).toBeLessThan(r.keep.installments[0].parcela);
    expect(r.ported.metrics.saldoZeroAt).toBeLessThanOrEqual(r.keep.metrics.saldoZeroAt);
  });
  it('taxa maior → não vale a pena', () => {
    const r = comparePortability({ ...base, newAnnualRate: 0.14 });
    expect(r.economia).toBeLessThan(0);
  });
  it('payback cobre os custos no mês em que a economia acumulada passa deles', () => {
    const r = comparePortability({ ...base, costs: 30000 });
    expect(r.paybackMonth).not.toBeNull();
    const n = r.paybackMonth!;
    const cum = (until: number) => {
      let acc = -30000;
      for (let t = 0; t < until; t++) {
        acc += (r.keep.installments[t]?.parcela ?? 0) - (r.ported.installments[t]?.parcela ?? 0);
      }
      return acc;
    };
    expect(cum(n)).toBeGreaterThanOrEqual(0);
    expect(cum(n - 1)).toBeLessThan(0);
  });
  it('sem custos, payback é imediato quando a parcela cai', () => {
    const r = comparePortability(base);
    expect(r.paybackMonth).toBe(1);
  });
  it('portar para SAC também é comparável', () => {
    const r = comparePortability({ ...base, newSystem: 'SAC' });
    expect(r.ported.system).toBe('SAC');
    expect(Number.isFinite(r.economia)).toBe(true);
  });
});

describe('portabilityBreakEven', () => {
  it('com seguro igual, a taxa limite é a própria taxa atual', () => {
    const b = portabilityBreakEven(base);
    expect(b.maxWorthwhileRate).toBeCloseTo(base.currentAnnualRate, 3);
  });
  it('com seguro maior, a taxa que compensa cai abaixo da atual', () => {
    const b = portabilityBreakEven({ ...base, newInsuranceMonthly: 250 });
    expect(b.maxWorthwhileRate).toBeLessThan(base.currentAnnualRate);
    expect(b.maxWorthwhileRate).toBeGreaterThan(0);
  });
  it('parcela alvo: taxa máxima para atingi-la', () => {
    const atual = comparePortability(base).keep.installments[0].parcela;
    const b = portabilityBreakEven(base, atual - 200);
    expect(b.maxRateForTargetParcela).not.toBeNull();
    const r = comparePortability({ ...base, newAnnualRate: b.maxRateForTargetParcela! });
    expect(r.ported.installments[0].parcela).toBeLessThanOrEqual(atual - 200 + 1);
  });
  it('parcela alvo impossível (menor que a de taxa 0) → null', () => {
    const b = portabilityBreakEven(base, 1);
    expect(b.maxRateForTargetParcela).toBeNull();
  });
});
