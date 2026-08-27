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

describe('regressão: % extra NÃO compõe a parcela base (TERM)', () => {
  const r = simulate(input, { ...base, extraMonthlyPct: 0.05 });
  it('parcela base (sem extra) fica estável, sem crescer 5% ao mês', () => {
    const base1 = r.installments[0].parcela - r.installments[0].extra;
    const base12 = r.installments[11].parcela - r.installments[11].extra;
    expect(base12).toBeLessThan(base1 * 1.03);
  });
  it('5% extra não quita em poucas dezenas de meses', () => {
    expect(r.metrics.saldoZeroAt).toBeGreaterThan(70);
  });
});

describe('regressão: modo payment não aumenta a dívida', () => {
  const input360: LoanInput = { ...input, principal: 1000000, months: 360 };
  it('saldo decresce após reduzir a parcela', () => {
    const r = simulate(input360, { extraLumpSum: [{ month: 12, amount: 50000 }], reduceMode: 'payment' });
    const s12 = r.installments[11].saldo;
    const s24 = r.installments[23].saldo;
    expect(s24).toBeLessThan(s12);
  });
  it('payment + % extra: dívida para de crescer após o 1º mês e quita', () => {
    const r = simulate(input360, { extraLumpSum: [], extraMonthlyPct: 0.05, reduceMode: 'payment' });
    expect(r.metrics.saldoZeroAt).toBeLessThan(400);
    for (let k = 2; k < r.installments.length; k++) {
      expect(r.installments[k].saldo).toBeLessThan(r.installments[k - 1].saldo);
    }
  });
});

describe('regressão: SAC payment mode com aporte recorrente não estica a dívida', () => {
  const inputSac: LoanInput = { ...input, system: 'SAC', principal: 1000000, months: 360 };
  const rec = { extraLumpSum: [], recurringExtra: { amount: 1000, every: 12, startMonth: 12 }, reduceMode: 'payment' as const };
  it('quita dentro do prazo contratual (não estica para 500+ meses)', () => {
    const r = simulate(inputSac, rec);
    expect(r.metrics.saldoZeroAt).toBeLessThanOrEqual(365);
  });
  it('total pago menor que o base (economia positiva, não custo adicional)', () => {
    const base = simulate(inputSac, { extraLumpSum: [], reduceMode: 'term' });
    const r = simulate(inputSac, rec);
    expect(r.metrics.totalPago).toBeLessThan(base.metrics.totalPago);
  });
});

describe('regressão: SAC reduzir prazo encurta o prazo de verdade', () => {
  const inputSac: LoanInput = { ...input, system: 'SAC', principal: 1000000, months: 360 };
  it('com % extra mensal, term quita antes de 360', () => {
    const r = simulate(inputSac, { extraLumpSum: [], extraMonthlyPct: 0.14, reduceMode: 'term' });
    expect(r.metrics.saldoZeroAt).toBeLessThan(360);
  });
  it('com lump sum no mês 12, term quita antes de 360', () => {
    const r = simulate(inputSac, { extraLumpSum: [{ month: 12, amount: 100000 }], reduceMode: 'term' });
    expect(r.metrics.saldoZeroAt).toBeLessThan(360);
  });
  it('sem estratégias, term segue o cronograma (360)', () => {
    const r = simulate(inputSac, { extraLumpSum: [], reduceMode: 'term' });
    expect(r.metrics.saldoZeroAt).toBe(360);
  });
});

describe('aporte recorrente', () => {
  it('aplica aporte a cada X meses começando no mês Y', () => {
    const r = simulate(input, { ...base, recurringExtra: { amount: 10000, every: 12, startMonth: 6 } });
    expect(r.installments[5].extra).toBeCloseTo(10000, 2);
    expect(r.installments[17].extra).toBeCloseTo(10000, 2);
    expect(r.installments[11].extra).toBe(0);
  });
  it('aporte recorrente reduz o total pago', () => {
    const comAporte = simulate(input, { ...base, recurringExtra: { amount: 10000, every: 12, startMonth: 6 } });
    expect(comAporte.metrics.totalPago).toBeLessThan(simulate(input, base).metrics.totalPago);
  });
});

describe('pagar parcela do SAC no PRICE (paySacParcela)', () => {
  const input1M: LoanInput = { ...input, principal: 1000000, months: 360 };
  const sac = simulate({ ...input1M, system: 'SAC' }, base);
  it('mês 1 paga a diferença entre as parcelas (SAC − PRICE)', () => {
    const r = simulate(input1M, { ...base, paySacParcela: true });
    const price1 = simulate(input1M, base).installments[0].parcela;
    expect(r.installments[0].extra).toBeCloseTo(sac.installments[0].parcela - price1, 2);
    expect(r.installments[0].parcela).toBeCloseTo(sac.installments[0].parcela, 2);
  });
  it('quita antes do PRICE base e paga menos no total', () => {
    const r = simulate(input1M, { ...base, paySacParcela: true });
    const price = simulate(input1M, base);
    expect(r.metrics.saldoZeroAt).toBeLessThan(price.metrics.saldoZeroAt);
    expect(r.metrics.totalPago).toBeLessThan(price.metrics.totalPago);
  });
  it('no SAC a opção não muda nada', () => {
    const sacCom = simulate({ ...input1M, system: 'SAC' }, { ...base, paySacParcela: true });
    const sacSem = simulate({ ...input1M, system: 'SAC' }, base);
    expect(sacCom.metrics.totalPago).toBe(sacSem.metrics.totalPago);
  });
});
