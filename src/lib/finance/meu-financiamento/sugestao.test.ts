import { expect, it } from 'vitest';
import { projecao } from './model';
import type { AmortizacaoExtra, Baseline, ContractParams, ParcelaPaga, Projecao } from './model';
import { limiarUmaParcela } from './sugestao';

// Contrato sintético pequeno e barato: 12 parcelas de ~R$ 88,85, taxa 12,68%
// a.a. (~1% a.m.), sem TR nem seguro.
const PARAMS: ContractParams = {
  bank: 'X', system: 'PRICE', annualRate: 0.1268, trMonthly: 0, insuranceMonthly: 0, parcelasTotais: 12,
};
const BASELINE: Baseline = { version: 1, saldoDevedor: 1000, dataBase: '2026-09-08', proximaParcelaNumero: 1 };

function extra(valor: number): AmortizacaoExtra {
  return { dataPagamento: BASELINE.dataBase, valor, origem: 'proprio', modo: 'term' };
}

/** Parcela paga do mês simulado pelo fluxo real (primeira pendente). */
function parcelaPaga(params: ContractParams, baseline: Baseline, pagas: ParcelaPaga[], extras: AmortizacaoExtra[]): ParcelaPaga {
  const primeira = projecao(params, baseline, pagas, extras).parcelas[0];
  return { parcelaNumero: primeira.parcelaNumero, valor: primeira.parcela, dataPagamento: baseline.dataBase };
}

/**
 * Reproduz a ação real do form: paga a parcela do mês + aporte, com o total em
 * centavos exatos (`roundCents(parcela) + aporte`), ou seja, o extra efetivo é
 * `aporte + (roundCents(parcela) - parcela)`.
 */
function simularJunto(
  params: ContractParams,
  baseline: Baseline,
  pagas: ParcelaPaga[],
  extras: AmortizacaoExtra[],
  aporte: number,
): Projecao {
  const paga = parcelaPaga(params, baseline, pagas, extras);
  const efetivo = Math.round(paga.valor * 100) / 100 + aporte - paga.valor;
  return projecao(params, baseline, [...pagas, paga], [...extras, extra(efetivo)]);
}

function quitaJunto(params: ContractParams, baseline: Baseline, pagas: ParcelaPaga[], extras: AmortizacaoExtra[]): number | null {
  const paga = parcelaPaga(params, baseline, pagas, extras);
  return projecao(params, baseline, [...pagas, paga], extras).quitaEm;
}

it('encontra o primeiro centavo com efeito por varredura no cenário sintético', () => {
  const base = quitaJunto(PARAMS, BASELINE, [], []);
  expect(base).not.toBeNull();
  let primeiroCentavo = 1;
  while (primeiroCentavo <= 20000) {
    const p = simularJunto(PARAMS, BASELINE, [], [], primeiroCentavo / 100);
    if (p.saldoEfetivo === 0 || (p.quitaEm != null && p.quitaEm <= base! - 1)) break;
    primeiroCentavo += 1;
  }
  expect(primeiroCentavo).toBeLessThanOrEqual(20000);

  const limiar = limiarUmaParcela(PARAMS, BASELINE, [], []);
  expect(limiar).toBeCloseTo(primeiroCentavo / 100, 2);
  // O centavo anterior não tem efeito: o limiar é mínimo de verdade.
  expect(simularJunto(PARAMS, BASELINE, [], [], primeiroCentavo / 100 - 0.01).quitaEm).toBe(base);
});

it('cenário do review: retorno centavo exato corta exatamente 1 quando aplicado junto', () => {
  // Caso onde o valor 577,40 exibido antes não cortava após o arredondamento
  // do form (parcela 3636,1028 → roundCents 3636,10 deixa o extra efetivo
  // 0,0028 abaixo do limiar contínuo).
  const params: ContractParams = {
    bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
    insuranceMonthly: 100, parcelasTotais: 360,
  };
  const baseline: Baseline = { version: 1, saldoDevedor: 354800, dataBase: '2026-09-08', proximaParcelaNumero: 142 };
  const base = quitaJunto(params, baseline, [], []);
  expect(base).toBe(360);

  const limiar = limiarUmaParcela(params, baseline, [], []);
  expect(limiar).not.toBeNull();
  expect(limiar! * 100).toBeCloseTo(Math.round(limiar! * 100), 6);
  expect(simularJunto(params, baseline, [], [], limiar!).quitaEm).toBe(base! - 1);
  expect(simularJunto(params, baseline, [], [], limiar! - 0.01).quitaEm).toBe(base);
});

it('cenário padrão: o limiar reduz a quitação e o centavo anterior não', () => {
  const params: ContractParams = {
    bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
    insuranceMonthly: 100, parcelasTotais: 360,
  };
  const baseline: Baseline = { version: 1, saldoDevedor: 1000000, dataBase: '2026-09-08', proximaParcelaNumero: 141 };
  const base = quitaJunto(params, baseline, [], []);
  const limiar = limiarUmaParcela(params, baseline, [], []);
  expect(limiar).not.toBeNull();
  expect(simularJunto(params, baseline, [], [], limiar!).quitaEm).toBeLessThan(base!);
  expect(simularJunto(params, baseline, [], [], limiar! - 0.01).quitaEm).toBe(base);
});

it('saldo zero (contrato quitado) retorna null', () => {
  expect(limiarUmaParcela(PARAMS, { ...BASELINE, saldoDevedor: 0 }, [], [])).toBeNull();
});

it('extras já zeraram o saldo: sem parcela futura, retorna null', () => {
  expect(limiarUmaParcela(PARAMS, BASELINE, [], [extra(1000)])).toBeNull();
});

it('extras existentes entram no cenário base antes da bisseção', () => {
  const extras = [extra(100)];
  const base = quitaJunto(PARAMS, BASELINE, [], extras);
  const limiar = limiarUmaParcela(PARAMS, BASELINE, [], extras);
  expect(limiar).not.toBeNull();
  expect(simularJunto(PARAMS, BASELINE, [], extras, limiar!).quitaEm).toBeLessThan(base!);
  expect(simularJunto(PARAMS, BASELINE, [], extras, limiar! - 0.01).quitaEm).toBe(base);
});
