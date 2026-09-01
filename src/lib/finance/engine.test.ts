import { describe, expect, it } from 'vitest';
import { convertAnnualToMonthly, irrMonthly, pmt, simulate } from './engine';
import type { LoanInput } from './types';

describe('engine formulas', () => {
  it('converte taxa anual para mensal efetiva', () => {
    expect(convertAnnualToMonthly(0.10)).toBeCloseTo(0.007974140428903764, 12);
  });
  it('calcula PMT (parcela constante)', () => {
    expect(pmt(0.007974140428903764, 100, 100000)).toBeCloseTo(1454.9210468803736, 6);
  });
  it('calcula IRR mensal', () => {
    const flow = [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1100];
    expect(irrMonthly(flow)).toBeCloseTo(0.1, 6);
  });
  it('PRICE com juros zero e TR produz cronograma completo finito', () => {
    const result = simulate({
      system: 'PRICE', principal: 300000, annualRate: 0, months: 360,
      trMonthly: 0.0017, insuranceMonthly: 100,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
    });
    expect(result.installments.length).toBeGreaterThanOrEqual(360);
    expect(result.installments.length).toBeLessThanOrEqual(720);
    expect(result.installments.every((item) =>
      Object.values(item).every((value) => Number.isFinite(value))
    )).toBe(true);
    expect(result.installments.every((item) => item.parcela >= 0)).toBe(true);
    expect(result.installments.at(-1)?.saldo).toBe(0);
  });
  it('rejeita PRICE zero-rate quando parcela não cobre correção', () => {
    expect(() => simulate({
      system: 'PRICE', principal: 300000, annualRate: 0, months: 600,
      trMonthly: 0.01, insuranceMonthly: 0,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
    })).toThrow(/não amortiza/i);
  });

  it('rejeita prazo fracionário no engine', () => {
    expect(() => simulate({
      system: 'SAC', principal: 300000, annualRate: 0.1, months: 360.5,
      trMonthly: 0, insuranceMonthly: 0,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
    })).toThrow(/prazo/i);
  });
});

describe('precedência fixedPayment × paySacParcela', () => {
  const input: LoanInput = {
    system: 'PRICE', principal: 1000000, annualRate: 0.105, months: 360,
    trMonthly: 0.0017, insuranceMonthly: 100,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
  };
  const base = { extraLumpSum: [], reduceMode: 'term' as const };

  it('alvo fixo exato vence o SAC enquanto ativo: paga só o gap do fixo', () => {
    const sac = simulate({ ...input, system: 'SAC' }, base);
    const sacGap = sac.installments[0].parcela - simulate(input, base).installments[0].parcela;
    const fixed = simulate(input, { ...base, fixedPayment: { amount: 10000 } });
    const mixed = simulate(input, {
      ...base,
      fixedPayment: { amount: 10000 },
      paySacParcela: true,
    });

    expect(mixed.installments[0].parcela).toBeCloseTo(10000, 2);
    expect(mixed.installments[0].extra).toBeCloseTo(fixed.installments[0].extra, 2);
    expect(mixed.installments[0].extra).toBeLessThan(fixed.installments[0].extra + sacGap - 1);
  });

  it('antes do início do fixo o SAC vale; a partir do início só o fixo (sem empilhar)', () => {
    const sacGap = simulate(input, { ...base, paySacParcela: true }).installments[0].extra;
    const mixed = simulate(input, {
      ...base,
      fixedPayment: { amount: 10000, startMonth: 6 },
      paySacParcela: true,
    });

    expect(mixed.installments[0].extra).toBeCloseTo(sacGap, 2);
    expect(mixed.installments[5].parcela).toBeCloseTo(10000, 2);
    const sacGap6 = simulate(input, { ...base, paySacParcela: true }).installments[5].extra;
    expect(mixed.installments[5].extra).toBeLessThan(sacGap6);
  });
});

describe('modo reduzir parcela com janela do pagamento fixo', () => {
  const input: LoanInput = {
    system: 'PRICE', principal: 1000000, annualRate: 0.105, months: 360,
    trMonthly: 0.0017, insuranceMonthly: 100,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
  };

  it('janela do fixo encerrada: não trava, amortização não fica negativa e saldo quita', () => {
    const r = simulate(input, {
      extraLumpSum: [],
      reduceMode: 'payment',
      fixedPayment: { amount: 12000, untilMonth: 12 },
    });
    expect(r.installments.every((i) => i.amortizacao >= 0)).toBe(true);
    expect(r.installments.slice(12).some((i) => i.amortizacao > 0)).toBe(true);
    expect(r.installments.at(-1)?.saldo).toBe(0);
    expect(r.metrics.paymentApplied).toBe(false);
  });

  it('antes da janela paga o contrato; na janela o valor fixo; depois volta ao contrato', () => {
    const base = simulate(input, { extraLumpSum: [], reduceMode: 'term' });
    const r = simulate(input, {
      extraLumpSum: [],
      reduceMode: 'payment',
      fixedPayment: { amount: 12000, startMonth: 24, untilMonth: 36 },
    });
    expect(r.installments[0].parcela).toBeCloseTo(base.installments[0].parcela, 2);
    expect(r.installments[23].parcela).toBeCloseTo(12000, 2);
    expect(r.installments[35].parcela).toBeCloseTo(12000, 2);
    expect(r.installments[36].parcela).toBeCloseTo(base.installments[36].parcela, 2);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });

  it('após a janela do % extra, aporte pontual não usa % fantasma no cálculo da parcela', () => {
    const r = simulate(input, {
      extraLumpSum: [{ month: 13, amount: 50000 }],
      reduceMode: 'payment',
      extraMonthlyPct: 0.14,
      extraMonthlyPctUntilMonth: 12,
    });
    expect(r.installments.every((i) => i.amortizacao >= 0)).toBe(true);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });

  it('aporte recorrente com janela no modo payment não trava depois da janela', () => {
    const r = simulate(input, {
      extraLumpSum: [],
      reduceMode: 'payment',
      recurringExtra: { amount: 8000, every: 1, startMonth: 1, untilMonth: 12 },
    });
    expect(r.installments.every((i) => i.amortizacao >= 0)).toBe(true);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });
});

describe('SAC: fim da janela de aporte re-ancora a amortização no saldo real', () => {
  const input: LoanInput = {
    system: 'SAC', principal: 1000000, annualRate: 0.105, months: 360,
    trMonthly: 0.0017, insuranceMonthly: 100,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
  };
  const finite = (r: ReturnType<typeof simulate>) =>
    r.installments.every((i) => Object.values(i).every((v) => Number.isFinite(v)));

  it.each([300, 330, 340])(
    '% extra 14,17% até o mês %i: finito, amortiza após a janela e quita no prazo do contrato',
    (untilMonth) => {
      const r = simulate(input, {
        extraLumpSum: [],
        reduceMode: 'payment',
        extraMonthlyPct: 0.1417,
        extraMonthlyPctUntilMonth: untilMonth,
      });
      expect(finite(r)).toBe(true);
      expect(r.installments.slice(untilMonth).some((i) => i.amortizacao > 0)).toBe(true);
      expect(r.installments.at(-1)?.saldo).toBe(0);
      expect(r.metrics.saldoZeroAt).toBe(360);
    }
  );

  it('pagamento fixo 13000 até o mês 340: finito, amortiza e quita', () => {
    const r = simulate(input, {
      extraLumpSum: [],
      reduceMode: 'payment',
      fixedPayment: { amount: 13000, untilMonth: 340 },
    });
    expect(finite(r)).toBe(true);
    expect(r.installments.some((i) => i.amortizacao > 0)).toBe(true);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });

  it('PRICE retido: mesma janela de % extra continua finita e quitando', () => {
    const r = simulate({ ...input, system: 'PRICE' }, {
      extraLumpSum: [],
      reduceMode: 'payment',
      extraMonthlyPct: 0.1417,
      extraMonthlyPctUntilMonth: 300,
    });
    expect(finite(r)).toBe(true);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });

  it('nenhuma combinação de janela devolve NaN/lixo: quita finita ou lança erro claro', () => {
    const configs: Array<Parameters<typeof simulate>[1]> = [
      { extraLumpSum: [], reduceMode: 'payment', extraMonthlyPct: 0.05, extraMonthlyPctUntilMonth: 300 },
      { extraLumpSum: [], reduceMode: 'payment', extraMonthlyPct: 0.22, extraMonthlyPctUntilMonth: 300 },
      { extraLumpSum: [], reduceMode: 'payment', extraMonthlyPct: 0.5, extraMonthlyPctUntilMonth: 300 },
      { extraLumpSum: [], reduceMode: 'payment', fixedPayment: { amount: 9000, untilMonth: 300 } },
      { extraLumpSum: [], reduceMode: 'payment', fixedPayment: { amount: 13000, untilMonth: 340 } },
      { extraLumpSum: [], reduceMode: 'payment', recurringExtra: { amount: 8000, every: 1, startMonth: 1, untilMonth: 340 } },
      { extraLumpSum: [{ month: 1, amount: 500 }], reduceMode: 'payment' },
      { extraLumpSum: [], reduceMode: 'payment', extraMonthlyPct: 0.1417, extraMonthlyPctUntilMonth: 300, paySacParcela: true },
    ];
    for (const system of ['SAC', 'PRICE'] as const) {
      for (const strategies of configs) {
        let outcome: { kind: 'ok'; installments: ReturnType<typeof simulate>['installments'] } | { kind: 'err'; message: string };
        try {
          outcome = { kind: 'ok', installments: simulate({ ...input, system }, strategies).installments };
        } catch (e) {
          outcome = { kind: 'err', message: (e as Error).message };
        }
        if (outcome.kind === 'ok') {
          expect(outcome.installments.every((i) => Object.values(i).every((v) => Number.isFinite(v)))).toBe(true);
          expect(outcome.installments.at(-1)?.saldo).toBe(0);
        } else {
          expect(outcome.message).toMatch(/não amortiza|NaN|não finito/i);
        }
      }
    }
  });

  it('paySacParcela: a janela do gap SAC termina no prazo do contrato, nenhuma parcela além do mês do contrato', () => {
    const r = simulate({ ...input, system: 'PRICE' }, {
      extraLumpSum: [],
      reduceMode: 'payment',
      paySacParcela: true,
    });
    expect(r.installments.every((i) => i.month <= input.months)).toBe(true);
    expect(r.metrics.saldoZeroAt).toBeLessThanOrEqual(input.months);
    expect(r.installments.at(-1)?.saldo).toBe(0);
  });
});
