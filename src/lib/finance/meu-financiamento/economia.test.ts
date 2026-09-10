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

it('sem extras a economia é zero', () => {
  expect(economiaAmortizacoes(PARAMS, BASELINE, [], [])).toBe(0);
});

it('caso fechado sem encargos: amortização que quita adiantado não gera economia', () => {
  // Juros, TR e seguro zerados: o total pago é só o principal (1200), então
  // encurtar o prazo com um aporte de 600 apenas troca principal por principal
  // — não há encargo evitado e a economia é exatamente zero.
  const params: ContractParams = {
    bank: 'X', system: 'PRICE', annualRate: 0, trMonthly: 0, insuranceMonthly: 0, parcelasTotais: 12,
  };
  const baseline: Baseline = { version: 1, saldoDevedor: 1200, dataBase: '2026-09-08', proximaParcelaNumero: 1 };
  const term: AmortizacaoExtra = { dataPagamento: '2026-09-08', valor: 600, origem: 'proprio', modo: 'term' };
  const payment: AmortizacaoExtra = { ...term, modo: 'payment' };
  expect(economiaAmortizacoes(params, baseline, [], [term])).toBeCloseTo(0, 6);
  expect(economiaAmortizacoes(params, baseline, [], [payment])).toBeCloseTo(0, 6);
});

it('amortização term no cenário padrão economiza os 601.065,98 do simulador', () => {
  // Valor travado do simulador (StrategyControls "Economia total" =
  // base.metrics.totalPago − current.metrics.totalPago) para saldo 1.000.000,
  // 220 restantes e aporte de 100.000 term. A soma de juros+correção+seguro da
  // projecao pura dava 601.588,26 (523,06 a mais) por causa do modo term da
  // engine (cronograma contratual) x bisseção pmt do model.
  const economia = economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]);
  expect(economia).toBeGreaterThan(0);
  expect(economia).toBeCloseTo(601065.98, 2);
});

it('amortização payment também tem economia positiva na métrica do simulador', () => {
  // Aporte pontual payment: no engine, o recálculo pmt(m+TR) sobre o saldo
  // restante fica acima da parcela contratual neste cenário, então o aporte
  // acaba encurtando o prazo como o term. O oráculo aqui é a métrica do
  // simulador (não uma comparação term x payment).
  const payment = economiaAmortizacoes(PARAMS, BASELINE, [], [PAYMENT_100K]);
  expect(payment).toBeGreaterThan(0);
  expect(payment).toBeCloseTo(601065.98, 2);
});

it('parcelas pagas entram no cenário e a economia considera só o futuro restante', () => {
  const semMov = projecao(PARAMS, BASELINE, [], []);
  const pagas: ParcelaPaga[] = [{ parcelaNumero: 141, valor: semMov.parcelas[0].parcela, dataPagamento: '2026-10-05' }];
  const economia = economiaAmortizacoes(PARAMS, BASELINE, pagas, [TERM_100K]);
  expect(economia).toBeGreaterThan(0);
  // Pagar a 141 antes não pode aumentar a economia dos encargos evitados.
  expect(economia).toBeLessThan(economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]));
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
