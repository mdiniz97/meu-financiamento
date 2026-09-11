import { expect, it } from 'vitest';
import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga } from './model';
import {
  economiaAcumulada,
  economiaAmortizacoes,
  economiaDoAporte,
  limiarParcelaEngine,
  type PeriodoEstado,
} from './economia';

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

it('economiaDoAporte é a diferença de totalPago do cenário (métrica do E se?)', () => {
  // Cenário do diagnóstico: parcela 206/360, saldo R$ 597.736,77, aporte de
  // R$ 1.814,85. O E se? mostra R$ 6.775,64.
  const baseline: Baseline = { version: 1, saldoDevedor: 597736.77, dataBase: '2026-09-08', proximaParcelaNumero: 206 };
  const input = toLoanInput(PARAMS, baseline);
  const estrategias = { extraLumpSum: [{ month: 1, amount: 1814.85, reduceMode: 'term' as const }], reduceMode: 'term' as const };
  const esperado = simulate(input).metrics.totalPago - simulate(input, estrategias).metrics.totalPago;
  expect(economiaDoAporte(input, 1814.85)).toBeCloseTo(esperado, 6);
  expect(economiaDoAporte(input, 1814.85)).toBeCloseTo(6775.64, 2);
});

it('economiaDoAporte nunca é negativa e respeita o modo', () => {
  const input = toLoanInput(PARAMS, BASELINE);
  expect(economiaDoAporte(input, 0)).toBe(0);
  expect(economiaDoAporte(input, 100000, 'payment')).toBeGreaterThan(0);
});

it('limiarParcelaEngine corta exatamente 1 e o centavo anterior não', () => {
  const input = toLoanInput(PARAMS, BASELINE);
  const base = simulate(input).metrics.saldoZeroAt;
  const limiar = limiarParcelaEngine(input);
  expect(limiar).not.toBeNull();
  const com = simulate(input, { extraLumpSum: [{ month: 1, amount: limiar!, reduceMode: 'term' }], reduceMode: 'term' });
  expect(com.metrics.saldoZeroAt).toBe(base - 1);
  const anterior = simulate(input, { extraLumpSum: [{ month: 1, amount: limiar! - 0.01, reduceMode: 'term' }], reduceMode: 'term' });
  expect(anterior.metrics.saldoZeroAt).toBe(base);
  // Valor do cenário padrão (mesma posição da sugestão): R$ 370,82.
  expect(limiar).toBeCloseTo(370.82, 2);
});

it('limiarParcelaEngine retorna null sem principal', () => {
  const input = toLoanInput(PARAMS, BASELINE);
  expect(limiarParcelaEngine({ ...input, principal: 0 })).toBeNull();
});

const PERIODO_S1: PeriodoEstado = {
  id: 's1',
  version: 1,
  saldoDevedor: 1000000,
  dataBase: '2026-09-08',
  proximaParcelaNumero: 141,
  diaVencimento: 8,
  bank: PARAMS.bank,
  system: PARAMS.system,
  annualRate: PARAMS.annualRate,
  trMonthly: PARAMS.trMonthly,
  insuranceMonthly: PARAMS.insuranceMonthly,
  parcelasTotais: PARAMS.parcelasTotais,
};
const EXTRA_S1 = { ...TERM_100K, stateId: 's1' };

function periodoS2(): PeriodoEstado {
  return { ...PERIODO_S1, id: 's2', version: 2, saldoDevedor: 500000, dataBase: '2026-10-08' };
}

it('economiaAcumulada de um período é igual ao cálculo do estado vigente', () => {
  expect(economiaAcumulada([PERIODO_S1], { pagas: [], extras: [EXTRA_S1] })).toBe(
    economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]),
  );
});

it('economiaAcumulada sem extras é zero', () => {
  expect(economiaAcumulada([PERIODO_S1], { pagas: [], extras: [] })).toBe(0);
});

it('economiaAcumulada soma a economia de cada período', () => {
  const s2 = periodoS2();
  const extraS2 = { ...TERM_100K, valor: 50000, stateId: 's2' };
  const esperado =
    economiaAcumulada([PERIODO_S1], { pagas: [], extras: [EXTRA_S1] })
    + economiaAcumulada([s2], { pagas: [], extras: [extraS2] });
  expect(economiaAcumulada([PERIODO_S1, s2], { pagas: [], extras: [EXTRA_S1, extraS2] })).toBeCloseTo(esperado, 6);
});

it('período sem extras próprios contribui zero sem duplicar o período anterior', () => {
  // O saldo do baseline novo já embute as amortizações do período anterior;
  // somar por período evita contar a mesma economia duas vezes.
  const s2 = periodoS2();
  expect(economiaAcumulada([PERIODO_S1, s2], { pagas: [], extras: [EXTRA_S1] })).toBe(
    economiaAmortizacoes(PARAMS, BASELINE, [], [TERM_100K]),
  );
});
