import { expect, it } from 'vitest';
import { projecao } from './model';
import type { Baseline, ContractParams } from './model';
import { cenarioAporte } from './aporte-cenario';
import type { EstadoCenarioAporte } from './aporte-cenario';

const PARAMS: ContractParams = {
  bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, parcelasTotais: 360,
};
const BASELINE: Baseline = { version: 1, saldoDevedor: 1000000, dataBase: '2026-09-08', proximaParcelaNumero: 141 };

function estado(): EstadoCenarioAporte {
  return {
    params: PARAMS,
    baseline: BASELINE,
    pagas: [],
    extras: [],
    projecao: projecao(PARAMS, BASELINE, [], []),
  };
}

it('term: aporte pequeno não reduz o prazo e grande reduz', () => {
  const e = estado();
  const pequeno = cenarioAporte(e, 10, 'term');
  expect(pequeno).not.toBeNull();
  expect(pequeno!.parcelasEliminadas).toBe(0);
  expect(pequeno!.parcelaEstimada).toBeNull();
  expect(pequeno!.economia).toBeGreaterThanOrEqual(0);

  const grande = cenarioAporte(e, 100000, 'term');
  expect(grande!.parcelasEliminadas).toBeGreaterThan(0);
  expect(grande!.economia).toBeGreaterThan(0);
});

it('payment: não corta prazo e estima a parcela do mês 2 (menor que a atual)', () => {
  const e = estado();
  const resultado = cenarioAporte(e, 200000, 'payment', { parcelaEstimada: true });
  expect(resultado).not.toBeNull();
  expect(resultado!.parcelasEliminadas).toBe(0);
  expect(resultado!.economia).toBeGreaterThan(0);
  expect(resultado!.parcelaEstimada).not.toBeNull();
  expect(resultado!.parcelaEstimada!).toBeLessThan(e.projecao.parcelas[0].parcela);
});

it('payment sem a flag não estima parcela', () => {
  const resultado = cenarioAporte(estado(), 200000, 'payment');
  expect(resultado!.parcelasEliminadas).toBe(0);
  expect(resultado!.parcelaEstimada).toBeNull();
});

it('retorna null sem aporte positivo ou sem saldo efetivo', () => {
  expect(cenarioAporte(estado(), 0, 'term')).toBeNull();
  expect(cenarioAporte(estado(), -1, 'term')).toBeNull();
  const quitado: EstadoCenarioAporte = {
    ...estado(),
    baseline: { ...BASELINE, saldoDevedor: 0 },
    projecao: projecao(PARAMS, { ...BASELINE, saldoDevedor: 0 }, [], []),
  };
  expect(cenarioAporte(quitado, 100, 'term')).toBeNull();
});
