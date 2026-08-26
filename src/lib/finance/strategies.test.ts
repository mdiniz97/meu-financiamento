import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import type { LoanInput, Strategies } from './types';

const input: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const base: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('amortização pontual (lump sum)', () => {
  it('amortizar 10.000 no mês 12 reduz juros totais', () => {
    const comExtra = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 10000 }] });
    const semExtra = simulate(input, base);
    expect(comExtra.metrics.totalJuros).toBeLessThan(semExtra.metrics.totalJuros);
  });
  it('no mês 12 a parcela tem extra de 10.000', () => {
    const r = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 10000 }] });
    expect(r.installments[11].extra).toBeCloseTo(10000, 2);
  });
  it('extra pontual quita antes (term) ou reduz parcela (payment)', () => {
    const term = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 50000 }] });
    expect(term.metrics.saldoZeroAt).toBeLessThan(100);
  });
});

describe('percentual extra mensal', () => {
  it('5% a mais na parcela antecipa quitação', () => {
    const r = simulate(input, { ...base, extraMonthlyPct: 0.05 });
    expect(r.metrics.saldoZeroAt).toBeLessThan(100);
    expect(r.installments[0].extra).toBeGreaterThan(0);
  });
});

describe('FGTS anual', () => {
  it('amortiza FGTS nos meses 12 e 24', () => {
    const r = simulate(input, { ...base, fgtsAnnual: 3000 });
    expect(r.installments[11].extra).toBeCloseTo(3000, 2);
    expect(r.installments[23].extra).toBeCloseTo(3000, 2);
  });
});

describe('modo redução', () => {
  it('reduceMode payment recalcula parcela menor após extra', () => {
    const r = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 50000 }], reduceMode: 'payment' });
    const parcelaAntes = r.installments[10].parcela;
    const parcelaDepois = r.installments[12].parcela;
    expect(parcelaDepois).toBeLessThan(parcelaAntes);
  });
});

describe('portabilidade', () => {
  it('recontratar a 8% a.a. reduz parcela e juros', () => {
    const r = simulate(input, { ...base, portability: { annualRate: 0.08, bank: 'Itaú', insuranceMonthly: 100 } });
    expect(r.installments[0].juros).toBeLessThan(simulate(input, base).installments[0].juros);
  });
});
