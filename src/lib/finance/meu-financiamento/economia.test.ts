import { expect, it } from 'vitest';
import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga } from './model';
import { economiaAmortizacoes } from './economia';

const PARAMS: ContractParams = {
  bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, parcelasTotais: 360,
};
const BASELINE: Baseline = { version: 1, saldoDevedor: 1000000, dataBase: '2026-09-08', proximaParcelaNumero: 141 };
const TERM_100K: AmortizacaoExtra = { dataPagamento: '2026-09-08', valor: 100000, origem: 'proprio', modo: 'term' };
const PAYMENT_100K: AmortizacaoExtra = { ...TERM_100K, modo: 'payment' };

function somaParcelas(
  params: ContractParams,
  baseline: Baseline,
  pagas: ParcelaPaga[],
  extras: AmortizacaoExtra[],
): number {
  return projecao(params, baseline, pagas, extras).parcelas.reduce((soma, p) => soma + p.parcela, 0);
}

it('sem extras a economia é zero', () => {
  expect(economiaAmortizacoes(PARAMS, BASELINE, [], [])).toBe(0);
});

it('amortização term economiza a diferença das somas projetadas com e sem extras', () => {
  const esperado = somaParcelas(PARAMS, BASELINE, [], []) - somaParcelas(PARAMS, BASELINE, [], [TERM_100K]);
  const economia = economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]);
  expect(economia).toBeGreaterThan(0);
  expect(economia).toBeCloseTo(esperado, 6);
});

it('amortização payment também economiza, menos que a term equivalente', () => {
  // Oráculo do comportamento real: a term encurta o prazo e corta os juros de
  // todas as competências eliminadas; a payment mantém o prazo contratual e só
  // derruba a parcela, então evita menos juros e correção.
  const term = economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]);
  const payment = economiaAmortizacoes(PARAMS, BASELINE, [], [PAYMENT_100K]);
  const esperado = somaParcelas(PARAMS, BASELINE, [], []) - somaParcelas(PARAMS, BASELINE, [], [PAYMENT_100K]);
  expect(payment).toBeGreaterThan(0);
  expect(payment).toBeLessThan(term);
  expect(payment).toBeCloseTo(esperado, 6);
});

it('parcelas pagas entram no cenário e a economia considera só o futuro restante', () => {
  const semMov = projecao(PARAMS, BASELINE, [], []);
  const pagas: ParcelaPaga[] = [{ parcelaNumero: 141, valor: semMov.parcelas[0].parcela, dataPagamento: '2026-10-05' }];
  const esperado = somaParcelas(PARAMS, BASELINE, pagas, []) - somaParcelas(PARAMS, BASELINE, pagas, [TERM_100K]);
  expect(economiaAmortizacoes(PARAMS, BASELINE, pagas, [TERM_100K])).toBeCloseTo(esperado, 6);
});

it('extras que zeram o saldo não produzem NaN nem economia negativa', () => {
  const economia = economiaAmortizacoes(
    PARAMS,
    { ...BASELINE, saldoDevedor: 5000 },
    [],
    [{ dataPagamento: '2026-09-08', valor: 5000, origem: 'proprio', modo: 'term' }],
  );
  expect(economia).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(economia)).toBe(true);
});

it('baseline já quitado (saldo 0) retorna 0', () => {
  expect(economiaAmortizacoes(PARAMS, { ...BASELINE, saldoDevedor: 0 }, [], [TERM_100K])).toBe(0);
});
