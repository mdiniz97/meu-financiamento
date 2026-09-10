import { expect, it } from 'vitest';
import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams } from './model';
import { limiarUmaParcela } from './sugestao';

// Contrato sintético pequeno e barato: 12 parcelas de ~R$ 88,85, taxa 12,68%
// a.a. (~1% a.m.), sem TR nem seguro. O primeiro centavo com efeito no prazo é
// conhecido por varredura (R$ 78,85 neste cenário).
const PARAMS: ContractParams = {
  bank: 'X', system: 'PRICE', annualRate: 0.1268, trMonthly: 0, insuranceMonthly: 0, parcelasTotais: 12,
};
const BASELINE: Baseline = { version: 1, saldoDevedor: 1000, dataBase: '2026-09-08', proximaParcelaNumero: 1 };

function extra(valor: number): AmortizacaoExtra {
  return { dataPagamento: BASELINE.dataBase, valor, origem: 'proprio', modo: 'term' };
}

function quita(params: ContractParams, baseline: Baseline, extras: AmortizacaoExtra[]): number | null {
  return projecao(params, baseline, [], extras).quitaEm;
}

it('encontra o primeiro centavo com efeito por varredura no cenário sintético', () => {
  const base = quita(PARAMS, BASELINE, []);
  expect(base).not.toBeNull();
  let primeiroCentavo = 1;
  while (primeiroCentavo <= 20000) {
    const p = projecao(PARAMS, BASELINE, [], [extra(primeiroCentavo / 100)]);
    if (p.saldoEfetivo === 0 || (p.quitaEm != null && p.quitaEm <= base! - 1)) break;
    primeiroCentavo += 1;
  }
  expect(primeiroCentavo).toBeLessThanOrEqual(20000);

  const limiar = limiarUmaParcela(PARAMS, BASELINE, [], []);
  expect(limiar).toBeCloseTo(primeiroCentavo / 100, 2);
  // O centavo anterior não tem efeito: o limiar é mínimo de verdade.
  const anterior = projecao(PARAMS, BASELINE, [], [extra((primeiroCentavo - 1) / 100)]);
  expect(anterior.quitaEm).toBe(base);
});

it('cenário padrão: o limiar reduz a quitação e o centavo anterior não', () => {
  const params: ContractParams = {
    bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
    insuranceMonthly: 100, parcelasTotais: 360,
  };
  const baseline: Baseline = { version: 1, saldoDevedor: 1000000, dataBase: '2026-09-08', proximaParcelaNumero: 141 };
  const base = quita(params, baseline, []);
  const limiar = limiarUmaParcela(params, baseline, [], []);
  expect(limiar).not.toBeNull();
  const comLimiar = projecao(params, baseline, [], [extra(limiar!)]);
  expect(comLimiar.quitaEm).toBeLessThan(base!);
  const comAnterior = projecao(params, baseline, [], [extra(limiar! - 0.01)]);
  expect(comAnterior.quitaEm).toBe(base);
});

it('saldo zero (contrato quitado) retorna null', () => {
  expect(limiarUmaParcela(PARAMS, { ...BASELINE, saldoDevedor: 0 }, [], [])).toBeNull();
});

it('extras já zeraram o saldo: sem parcela futura, retorna null', () => {
  expect(limiarUmaParcela(PARAMS, BASELINE, [], [extra(1000)])).toBeNull();
});

it('extras existentes entram no cenário base antes da bisseção', () => {
  const base = quita(PARAMS, BASELINE, [extra(100)]);
  const limiar = limiarUmaParcela(PARAMS, BASELINE, [], [extra(100)]);
  expect(limiar).not.toBeNull();
  const comLimiar = projecao(PARAMS, BASELINE, [], [extra(100), extra(limiar!)]);
  expect(comLimiar.quitaEm).toBeLessThan(base!);
  const comAnterior = projecao(PARAMS, BASELINE, [], [extra(100), extra(limiar! - 0.01)]);
  expect(comAnterior.quitaEm).toBe(base);
});
