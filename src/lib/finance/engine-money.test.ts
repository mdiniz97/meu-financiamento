import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import type { LoanInput, SimulationResult } from './types';

const CASE: LoanInput = {
  bank: 'Caixa', system: 'PRICE', principal: 1000000, annualRate: 0.105,
  months: 212, trMonthly: 0.0017000000000000001, insuranceMonthly: 100,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
};

function expectConserved(result: SimulationResult) {
  let previous = result.input.principal;
  for (const row of result.installments) {
    expect(previous).toBeGreaterThanOrEqual(0.005);
    expect(row.amortizacao).toBeGreaterThanOrEqual(0);
    expect(row.amortizacao).toBeLessThanOrEqual(previous + row.correcao + 0.005);
    expect(row.parcela).toBeCloseTo(row.juros + row.seguro + row.amortizacao, 6);
    expect(row.saldo).toBeCloseTo(previous + row.correcao - row.amortizacao, 2);
    previous = row.saldo;
  }
  expect(previous).toBe(0);
  expect(result.metrics.totalAmortizacao).toBeCloseTo(result.input.principal + result.metrics.totalCorrecao, 2);
}

describe('liquidação monetária e limiares de prazo', () => {
  it('PRICE sem TR termina no prazo sem seguro em uma parcela de resíduo numérico', () => {
    const r = simulate({ ...CASE, months: 360, trMonthly: 0 });
    expect(r.metrics.saldoZeroAt).toBe(360);
    expect(r.metrics.totalSeguro).toBe(36000);
    expectConserved(r);
  });

  it('fixa o total pago do baseline e do caso com aporte de R$ 387,74', () => {
    const base = simulate(CASE);
    expect(base.metrics.saldoZeroAt).toBe(213);
    expect(base.metrics.totalPago).toBeCloseTo(2596460.6971688177, 6);
    expect(base.metrics.totalJuros).toBeCloseTo(1308852.2212548065, 6);
    expect(base.metrics.totalCorrecao).toBeCloseTo(266308.4759140102, 6);
    expect(base.metrics.totalSeguro).toBe(21300);
    expect(base.metrics.totalAmortizacao).toBeCloseTo(1266308.4759140115, 6);
    const a = simulate(CASE, { extraLumpSum: [{ month: 1, amount: 387.74 }], reduceMode: 'term' });
    expect(a.metrics.totalPago).toBeCloseTo(2593614.737822578, 6);
    expect(a.metrics.totalJuros).toBeLessThan(base.metrics.totalJuros);
    expectConserved(base);
    expectConserved(a);
  });

  it('R$ 387,74 e R$ 387,75 no primeiro mês não separam seguros sobre resíduos subcentavo', () => {
    const a = simulate(CASE, { extraLumpSum: [{ month: 1, amount: 387.74 }], reduceMode: 'term' });
    const b = simulate(CASE, { extraLumpSum: [{ month: 1, amount: 387.75 }], reduceMode: 'term' });
    expect(a.metrics.saldoZeroAt).toBe(213);
    expect(b.metrics.saldoZeroAt).toBe(213);
    expect(a.metrics.totalSeguro).toBe(21300);
    expect(b.metrics.totalSeguro).toBe(21300);
    expect(a.metrics.totalPago - b.metrics.totalPago).toBeGreaterThan(0);
    expect(a.metrics.totalPago - b.metrics.totalPago).toBeLessThan(0.1);
    expectConserved(a);
    expectConserved(b);
  });

  it.each(['PRICE', 'SAC'] as const)('%s quita saldo corrigido com aporte integral sem deixar TR para outro mês', (system) => {
    const r = simulate({ ...CASE, system }, {
      extraLumpSum: [{ month: 1, amount: 2000000 }], reduceMode: 'term',
    });
    expect(r.metrics.saldoZeroAt).toBe(1);
    expect(r.metrics.totalSeguro).toBe(100);
    expect(r.metrics.totalAmortizacao).toBeCloseTo(1001700, 6);
    expect(r.metrics.totalPago).toBeCloseTo(1010155.1556836352, 6);
    expectConserved(r);
  });

  it('preserva limiar legítimo entre 26 e 25 meses sem apagar saldo de um centavo', () => {
    const input = { ...CASE, principal: 120000, annualRate: 1.01 ** 12 - 1, months: 60, trMonthly: 0 };
    const a = simulate(input, { extraLumpSum: [{ month: 1, amount: 61824.97 }], reduceMode: 'term' });
    const b = simulate(input, { extraLumpSum: [{ month: 1, amount: 61824.98 }], reduceMode: 'term' });
    // Oráculo por saldo fechado: limiar exato no mês 25 = R$ 61.824,97629752239.
    expect(a.metrics.saldoZeroAt).toBe(26);
    expect(a.installments[24].saldo).toBeCloseTo(0.0079961824, 6);
    expect(b.metrics.saldoZeroAt).toBe(25);
    expect(b.installments.at(-1)?.saldo).toBe(0);
    expectConserved(a);
    expectConserved(b);
  });

  it('limiar monetário do caso informado fica entre R$ 402,24 e R$ 402,25, não R$ 387,74/75', () => {
    const a = simulate(CASE, { extraLumpSum: [{ month: 1, amount: 402.24 }], reduceMode: 'term' });
    const b = simulate(CASE, { extraLumpSum: [{ month: 1, amount: 402.25 }], reduceMode: 'term' });
    // Saldo fechado no mês 212, com a recorrência PRICE adotada pelo simulador.
    expect(a.metrics.saldoZeroAt).toBe(213);
    expect(a.installments[211].saldo).toBeCloseTo(0.06504454, 5);
    expect(b.metrics.saldoZeroAt).toBe(212);
    expectConserved(a);
    expectConserved(b);
  });

  it('soma aportes pontuais do mesmo mês sem perder lançamentos', () => {
    const input = { ...CASE, principal: 1200, annualRate: 0, trMonthly: 0, months: 12, insuranceMonthly: 0 };
    const r = simulate(input, {
      extraLumpSum: [{ month: 1, amount: 250 }, { month: 1, amount: 350 }], reduceMode: 'term',
    });
    expect(r.installments[0].extra).toBe(600);
    expect(r.metrics.saldoZeroAt).toBe(6);
    expect(r.metrics.totalPago).toBe(1200);
    expectConserved(r);
  });

  it('rejeita aporte pontual em mês fracionário em vez de ignorá-lo silenciosamente', () => {
    expect(() => simulate(CASE, { extraLumpSum: [{ month: 1.5, amount: 500 }], reduceMode: 'term' })).toThrow(/mês/i);
  });

  it.each(['PRICE', 'SAC'] as const)('%s mantém contabilidade fechada nos modos e fontes de aporte', (system) => {
    for (const trMonthly of [0, 0.0017, 0.01]) {
      for (const reduceMode of ['term', 'payment'] as const) {
        for (const extra of [
          {},
          { extraLumpSum: [{ month: 12, amount: 50000 }] },
          { extraMonthlyPct: 0.15 },
          { recurringExtra: { amount: 1000, every: 12, startMonth: 6 } },
          { fixedPayment: { amount: 16000, untilMonth: 24 } },
        ]) {
          const r = simulate({ ...CASE, system, trMonthly, months: 60 }, { extraLumpSum: [], reduceMode, ...extra });
          expectConserved(r);
        }
      }
    }
  });
});
