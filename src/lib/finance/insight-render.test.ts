import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebtInsightCard } from '@/components/simulation/DebtInsightCard';
import { SmartResultCard } from '@/components/simulation/SmartResultCard';
import type { SmartCalcFields } from '@/components/simulation/SmartCalculator';
import { formToInput, formToStrategies, parseStoredForm, SIM_INPUT_KEY } from '@/lib/simulation-context';
import { simulate } from './engine';
import { recommendSmart, type SmartRecommendation } from './smart';
import type { LoanInput } from './types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));
afterEach(() => vi.unstubAllGlobals());

const input: LoanInput = {
  system: 'PRICE', principal: 1000000, annualRate: 0.105, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 100,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};

function openShownCandidate(rec: SmartRecommendation, fields: SmartCalcFields) {
  const stored = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { setItem: (key: string, value: string) => stored.set(key, value) });
  let tree: ReactElement | null = null;
  function Capture() {
    tree = SmartResultCard({ rec, fields });
    return tree;
  }
  renderToStaticMarkup(createElement(Capture));
  const open: (() => void)[] = [];
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode; onOpen?: () => void }>(child)) return;
      if (child.props.onOpen) open.push(child.props.onOpen);
      visit(child.props.children);
    });
  }
  visit(tree);
  expect(open.length).toBeGreaterThan(0);
  open[0]();
  const raw = stored.get(SIM_INPUT_KEY);
  expect(raw).toBeDefined();
  const form = parseStoredForm(raw!);
  return { input: formToInput(form), strategies: formToStrategies(form) };
}

describe('Smart preserva o candidato ao abrir simulador', () => {
  const fields: SmartCalcFields = {
    preferredSystem: 'AUTO', principal: '1000000', annualRate: '10.5',
    annualRateKind: 'effective-annual', maxMonths: '360', trMonthly: '0.17',
    insuranceMonthly: '100', bank: 'Caixa', maxPayment: '11000', fixedUntilMonth: '',
  };

  it('preserva payment quando term no mesmo prazo muda o custo em mais de um centavo', () => {
    const rec = recommendSmart({ ...input, maxPayment: 11000, maxMonths: 360 });
    const best = rec.best!;
    expect(best.result.strategies.reduceMode).toBe('payment');
    const term = simulate(best.result.input, { ...best.result.strategies, reduceMode: 'term' });
    expect(Math.abs(term.metrics.totalPago - best.result.metrics.totalPago)).toBeGreaterThan(0.01);
    const opened = openShownCandidate(rec, fields);
    expect(opened.strategies.reduceMode).toBe('payment');
    const replay = simulate(opened.input, opened.strategies);
    expect(replay.metrics.totalPago).toBeCloseTo(best.result.metrics.totalPago, 2);
    expect(replay.metrics.saldoZeroAt).toBe(best.result.metrics.saldoZeroAt);
  });

  it('usa snapshot calculado e janela clampada, nao campos posteriores do formulario', () => {
    const rec = recommendSmart({
      principal: 120000.25, annualRate: 0.12, trMonthly: 0, insuranceMonthly: 100.50,
      bank: 'BB', maxPayment: 10000.25, fixedUntilMonth: 400, minMonths: 60, maxMonths: 60,
    });
    const opened = openShownCandidate(rec, { ...fields, fixedUntilMonth: '400' });
    expect(opened.input).toEqual(rec.best!.result.input);
    expect(opened.strategies).toEqual(rec.best!.result.strategies);
    expect(opened.strategies.fixedPayment?.untilMonth).toBe(60);
  });

  it('preserva estrategia percentual sem transforma-la em pagamento fixo', () => {
    const rec = recommendSmart({ ...input, trMonthly: 0, maxPayment: 12000, maxMonths: 360, fixedPayment: false });
    const opened = openShownCandidate(rec, fields);
    expect(opened.strategies.fixedPayment).toBeUndefined();
    expect(opened.strategies.extraMonthlyPct).toBeCloseTo(rec.best!.result.strategies.extraMonthlyPct!, 12);
    expect(simulate(opened.input, opened.strategies).metrics.totalPago).toBeCloseTo(rec.best!.result.metrics.totalPago, 2);
  });
});

describe('Raio X descreve saldo observado sem prometer invariancia', () => {
  it.each([
    { extra: 0, saldo: 120400, text: 'cresce no mês 1' },
    { extra: 500, saldo: 119900, text: 'cai no mês 1' },
  ])('SAC com TR alta usa saldo do resultado atual: %j', ({ extra, saldo, text }) => {
    const sac: LoanInput = { ...input, system: 'SAC', principal: 120000, annualRate: 1.01 ** 12 - 1, months: 60, trMonthly: 0.02 };
    const result = simulate(sac, { extraLumpSum: extra ? [{ month: 1, amount: extra }] : [], reduceMode: 'term' });
    expect(result.installments[0].saldo).toBe(saldo);
    const html = renderToStaticMarkup(createElement(DebtInsightCard, { input: sac, result, isUnlimited: true }));
    expect(html).toContain(text);
    expect(html).not.toContain('para sempre');
    expect(html).not.toContain('em todas as parcelas');
    expect(html).not.toContain('a dívida abate todo mês');
    expect(html).not.toContain('Parcela mínima (última)');
  });

  it('PRICE sem queda observada nao inventa mes um', () => {
    const result = simulate(input);
    const partial = { ...result, installments: result.installments.slice(0, 12) };
    const html = renderToStaticMarkup(createElement(DebtInsightCard, { input, result: partial, isUnlimited: true }));
    expect(html).toContain('Não observada');
    expect(html).not.toContain('desde a primeira parcela');
  });

  it('prazo atual menor nao chama parcela de outro prazo de mesma parcela', () => {
    const short = { ...input, months: 100 };
    const html = renderToStaticMarkup(createElement(DebtInsightCard, { input: short, result: simulate(short), isUnlimited: true }));
    expect(html).not.toContain('mesma parcela');
    expect(html).toContain('213 meses');
    expect(html).toContain('sem estratégias');
  });

  it('limiar aproximado do mes um nao garante resultado depois das janelas', () => {
    const result = simulate(input, { extraLumpSum: [], reduceMode: 'term', fixedPayment: { amount: 9500, untilMonth: 1 } });
    const html = renderToStaticMarkup(createElement(DebtInsightCard, { input, result, isUnlimited: true }));
    expect(html).toContain('aproximado');
    expect(html).toContain('mês 1');
    expect(html).toContain('janelas');
    expect(html).not.toContain('os juros totais despencam');
  });
});
