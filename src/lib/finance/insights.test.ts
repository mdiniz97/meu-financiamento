import { describe, expect, it } from 'vitest';
import { priceBreakEven, recurringParcela, sacVsPrice } from './insights';
import { simulate } from './engine';
import { applyRecommendedPercent, deriveRows, rowsToStrategies } from './strategy-rows';
import type { LoanInput } from './types';

const base: LoanInput = {
  system: 'PRICE', principal: 1000000, annualRate: 0.105, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const noStrategy = { extraLumpSum: [], reduceMode: 'term' as const };

describe('priceBreakEven', () => {
  it('1M/360: parcela mínima ~R$ 10.255 e prazo máximo ~213 meses', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(b.minPayment).toBeCloseTo(10155.16, 2);
    expect(b.maxMonths).toBe(213);
    expect(b.monthsUntilAmortize).toBe(148);
  });
  it('prazo curto abate a dívida desde o mês 1', () => {
    const curto = { ...base, months: 100 };
    const r = simulate(curto, noStrategy);
    const b = priceBreakEven(curto, r);
    expect(b.monthsUntilAmortize).toBe(1);
    expect(b.maxMonths).toBe(213);
  });
  it('sem TR não há limite de prazo e a dívida abate no mês 1', () => {
    const semTr = { ...base, trMonthly: 0 };
    const r = simulate(semTr, noStrategy);
    const b = priceBreakEven(semTr, r);
    expect(b.maxMonths).toBe(Infinity);
    expect(b.monthsUntilAmortize).toBe(1);
  });
  it('parcela contratual abaixo da mínima indica dívida crescendo no início', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(r.installments[0].parcela).toBeLessThan(b.minPayment);
  });
  it('parcela se financiar já no prazo ideal (213 meses): ~R$ 10.165,84', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(b.idealPayment).toBeCloseTo(10165.84, 2);
    expect(b.idealPayment!).toBeGreaterThan(b.minPayment);
  });
  it('sem TR não há parcela ideal (prazo ilimitado)', () => {
    const semTr = { ...base, trMonthly: 0 };
    const b = priceBreakEven(semTr);
    expect(b.idealPayment).toBeNull();
  });
  it('aporte mensal necessário para abater no prazo atual: ~R$ 1.260,08 (14,17%)', () => {
    const r = simulate(base, noStrategy);
    const b = priceBreakEven(base, r);
    expect(b.requiredExtraMonthly).toBeCloseTo(1260.08, 2);
    expect(b.requiredExtraPct).toBeCloseTo(0.1417, 3);
  });
  it('recomendação substitui 5% existente pelo total necessário contra a parcela contratual', () => {
    const r = simulate(base, { ...noStrategy, extraMonthlyPct: 0.05 });
    const b = priceBreakEven(base, r);
    expect(b.requiredExtraMonthly).toBeCloseTo(815.33, 2);
    expect(b.requiredExtraPct).toBeCloseTo(0.0873, 3);
    expect(b.requiredTotalExtraPct).toBeCloseTo(0.1417, 3);
  });
  it('aporte recomendado total faz dívida cair desde o primeiro mês', () => {
    const initial = simulate(base, noStrategy);
    const recommendation = priceBreakEven(base, initial);
    const rows = applyRecommendedPercent([], recommendation.requiredTotalExtraPct);
    const applied = simulate(base, { ...noStrategy, ...rowsToStrategies(rows) });

    expect(rowsToStrategies(rows).extraMonthlyPct).toBe(0.1417);
    expect(applied.installments[0].valorUtil).toBeGreaterThan(0);
    expect(applied.installments[0].saldo).toBeLessThan(base.principal);
    expect(applied.installments[0].parcela).toBeGreaterThanOrEqual(recommendation.minPayment);
  });
  it('substitui percentual tardio e limitado por aporte contínuo que mantém amortização útil', () => {
    const bounded = {
      ...noStrategy,
      extraMonthlyPct: 0.05,
      extraMonthlyPctStartMonth: 24,
      extraMonthlyPctUntilMonth: 60,
      extraMonthlyPctReduceMode: 'payment' as const,
    };
    const current = simulate(base, bounded);
    const recommendation = priceBreakEven(base, current);
    const rows = applyRecommendedPercent(deriveRows(bounded), recommendation.requiredTotalExtraPct);
    const strategies = { ...bounded, ...rowsToStrategies(rows) };
    const applied = simulate(base, strategies);

    expect(strategies.extraMonthlyPctStartMonth).toBe(1);
    expect(strategies.extraMonthlyPctUntilMonth).toBeUndefined();
    expect(strategies.extraMonthlyPctReduceMode).toBe('term');
    expect(applied.installments.every((installment) => installment.valorUtil > 0)).toBe(true);
  });
  it.each([
    ['percentual existente', { extraMonthlyPct: 0.05 }],
    ['pagamento fixo', { fixedPayment: { amount: 9500 } }],
    ['pagar como SAC', { paySacParcela: true }],
    ['estratégias mistas', { extraMonthlyPct: 0.05, fixedPayment: { amount: 9300 }, paySacParcela: true }],
  ] as const)('total recomendado com %s faz valor útil do mês 1 ficar positivo', (_name, partial) => {
    const strategies = { ...noStrategy, ...partial };
    const current = simulate(base, strategies);
    const recommendation = priceBreakEven(base, current);
    const withoutPercent = simulate(base, {
      ...strategies,
      extraMonthlyPct: undefined,
      extraMonthlyPctStartMonth: undefined,
      extraMonthlyPctUntilMonth: undefined,
      extraMonthlyPctReduceMode: undefined,
    });
    const rows = applyRecommendedPercent(deriveRows(strategies), recommendation.requiredTotalExtraPct);
    const applied = simulate(base, { ...strategies, ...rowsToStrategies(rows) });

    expect(applied.installments[0].valorUtil).toBeGreaterThan(0);
    expect(applied.installments[0].saldo).toBeLessThan(base.principal);
    expect(applied.installments[0].parcela).toBeGreaterThanOrEqual(recommendation.minPayment);
    expect(applied.installments[0].parcela).toBeLessThanOrEqual(
      Math.max(withoutPercent.installments[0].parcela, recommendation.minPayment) + 1
    );
  });
  it('linha recomendada usa modo termo mesmo com modo global de reduzir parcela', () => {
    const globalPayment = { ...noStrategy, reduceMode: 'payment' as const };
    const current = simulate(base, globalPayment);
    const recommendation = priceBreakEven(base, current);
    const rows = applyRecommendedPercent(deriveRows(globalPayment), recommendation.requiredTotalExtraPct);
    const strategies = { ...globalPayment, ...rowsToStrategies(rows) };
    const applied = simulate(base, strategies);

    expect(strategies.extraMonthlyPctReduceMode).toBe('term');
    expect(applied.metrics.paymentApplied).toBe(false);
    expect(applied.installments[0].valorUtil).toBeGreaterThan(0);
    expect(applied.installments[0].parcela).toBeGreaterThanOrEqual(recommendation.minPayment);
  });
  it('pagamento fixo acima do SAC vence sem empilhar gaps na recomendação', () => {
    const strategies = { ...noStrategy, fixedPayment: { amount: 12000 }, paySacParcela: true };
    const current = simulate(base, strategies);
    const recommendation = priceBreakEven(base, current);
    const applied = simulate(base, strategies);

    expect(recommendation.requiredExtraMonthly).toBe(0);
    expect(recommendation.requiredTotalExtraPct).toBe(0);
    expect(applied.installments[0].parcela).toBeCloseTo(12000, 2);
    expect(applied.installments[0].parcela).toBeGreaterThanOrEqual(recommendation.minPayment);
  });
  it('prazo curto que já abate não exige aporte extra', () => {
    const curto = { ...base, months: 100 };
    const r = simulate(curto, noStrategy);
    const b = priceBreakEven(curto, r);
    expect(b.requiredExtraMonthly).toBe(0);
  });
  it('recurringParcela ignora aporte pontual no mês 1', () => {
    const lump1 = simulate(base, { ...noStrategy, extraLumpSum: [{ month: 1, amount: 100000 }] });
    expect(lump1.installments[0].parcela).toBeCloseTo(108895.07, 2);
    expect(recurringParcela(lump1)).toBeCloseTo(8895.07, 2);
  });
  it('recurringParcela mantém aporte percentual recorrente', () => {
    const pct5 = simulate(base, { ...noStrategy, extraMonthlyPct: 0.05 });
    expect(recurringParcela(pct5)).toBeCloseTo(9339.83, 2);
  });
});

describe('sacVsPrice', () => {
  const sacBase: LoanInput = { ...base, system: 'SAC' };
  it('SAC começa mais caro, cruza com a PRICE e economiza no total', () => {
    const c = sacVsPrice(sacBase);
    expect(c.parcela1Sac).toBeCloseTo(11232.93, 2);
    expect(c.parcela1Price).toBeCloseTo(8895.07, 2);
    expect(c.ultimaParcelaSac).toBeCloseTo(5262.29, 2);
    expect(c.crossingMonth).toBe(102);
    expect(c.economiaVsPrice).toBeCloseTo(1116212, 0);
    expect(c.dividaCai12mSac).toBeCloseTo(13423, 0);
  });
  it('dívida SAC cai em 12 meses enquanto a PRICE cresce no início', () => {
    const c = sacVsPrice(sacBase);
    expect(c.dividaCai12mSac).toBeGreaterThan(0);
    const price12 = simulate({ ...sacBase, system: 'PRICE' }, { extraLumpSum: [], reduceMode: 'term' }).metrics.dividaCai12m;
    expect(price12).toBeLessThan(0);
  });
});
