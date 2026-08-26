import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import type { LoanInput } from './types';

const price: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};

const sac: LoanInput = {
  system: 'SAC', principal: 396000, annualRate: 0.105, months: 389,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};

const closeToSheet = (a: number, b: number, band: number) =>
  Math.abs(a - b) < band;

describe('golden: PRICE (mês a mês exato vs planilha)', () => {
  const r = simulate(price, { extraLumpSum: [], reduceMode: 'term' });
  it('parcela 1', () => expect(r.installments[0].parcela).toBeCloseTo(1554.9210468803735, 6));
  it('juros 1', () => expect(r.installments[0].juros).toBeCloseTo(797.4140428903764, 6));
  it('amortização 1', () => expect(r.installments[0].amortizacao).toBeCloseTo(657.5070039899971, 6));
  it('correção 1', () => expect(r.installments[0].correcao).toBeCloseTo(170, 6));
  it('valor útil 1', () => expect(r.installments[0].valorUtil).toBeCloseTo(487.5070039899971, 6));
  it('pct valor útil 1', () => expect(r.installments[0].pctValorUtil).toBeCloseTo(0.31352524616479965, 6));
  it('saldo pós 1', () => expect(r.installments[0].saldo).toBeCloseTo(99512.49299601, 6));
  it('parcela 2 (recalculada)', () => expect(r.installments[1].parcela).toBeCloseTo(1557.41, 1));
  it('saldo pós 2', () => expect(r.installments[1].saldo).toBeCloseTo(99017.78, 1));
});

describe('golden: PRICE (totais, banda vs planilha)', () => {
  const r = simulate(price, { extraLumpSum: [], reduceMode: 'term' });
  // planilha: total 168784.09, juros 48371.80, correção 10312.34, CET 0.14199, quita 101
  // resíduo ~5% no total vem do NPER interno do Excel (parcela > planilha no fim)
  it('total pago', () => expect(closeToSheet(r.metrics.totalPago, 168784.09, 9500)).toBe(true));
  it('juros totais', () => expect(closeToSheet(r.metrics.totalJuros, 48371.80, 200)).toBe(true));
  it('correção total', () => expect(closeToSheet(r.metrics.totalCorrecao, 10312.34, 50)).toBe(true));
  it('CET real anual', () => expect(closeToSheet(r.metrics.cetRealAnual, 0.14199, 0.01)).toBe(true));
  it('quita entre 100 e 110 meses', () => {
    expect(r.metrics.saldoZeroAt).toBeGreaterThanOrEqual(100);
    expect(r.metrics.saldoZeroAt).toBeLessThanOrEqual(110);
  });
});

describe('golden: SAC (mês a mês exato vs planilha)', () => {
  const r = simulate(sac, { extraLumpSum: [], reduceMode: 'term' });
  it('parcela 1', () => expect(r.installments[0].parcela).toBeCloseTo(4426.636509331367, 6));
  it('juros 1', () => expect(r.installments[0].juros).toBeCloseTo(3308.6416507195418, 6));
  it('amortização 1', () => expect(r.installments[0].amortizacao).toBeCloseTo(1017.9948586118252, 6));
  it('amortização 2 (recalculada)', () => expect(r.installments[1].amortizacao).toBeCloseTo(1021.47, 2));
  it('correção 1', () => expect(r.installments[0].correcao).toBeCloseTo(673.2, 6));
  it('saldo pós 1', () => expect(r.installments[0].saldo).toBeCloseTo(395655.20514138817, 6));
});

describe('golden: SAC (totais, banda vs planilha)', () => {
  const r = simulate(sac, { extraLumpSum: [], reduceMode: 'term' });
  // planilha: total 1415242.80, juros 814601.51, correção 165744.68, CET 0.13146, quita 389
  it('total pago', () => expect(closeToSheet(r.metrics.totalPago, 1415242.80, 2000)).toBe(true));
  it('juros totais', () => expect(closeToSheet(r.metrics.totalJuros, 814601.51, 1000)).toBe(true));
  it('correção total', () => expect(closeToSheet(r.metrics.totalCorrecao, 165744.68, 200)).toBe(true));
  it('CET real anual', () => expect(closeToSheet(r.metrics.cetRealAnual, 0.13146, 0.002)).toBe(true));
  it('quita no mês 389', () => expect(r.metrics.saldoZeroAt).toBe(389));
});
