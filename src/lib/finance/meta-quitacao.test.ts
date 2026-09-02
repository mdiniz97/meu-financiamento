import { describe, expect, it } from 'vitest';
import { calcularMetaQuitacao } from './meta-quitacao';

const BASE = {
  saldoDevedor: 400000,
  taxaFinanciamento: 0.12,
  prazoRestanteMeses: 360,
  sistema: 'PRICE' as const,
  metaMeses: 120,
};

describe('calcularMetaQuitacao', () => {
  it('calcula o aporte mensal para quitar na meta', () => {
    const r = calcularMetaQuitacao(BASE);
    const i = Math.pow(1.12, 1 / 12) - 1;
    const parcelaAtual = (400000 * i) / (1 - Math.pow(1 + i, -360));
    const pagamentoMeta = (400000 * i) / (1 - Math.pow(1 + i, -120));
    expect(r.parcelaAtual).toBeCloseTo(parcelaAtual, 2);
    expect(r.pagamentoTotal).toBeCloseTo(pagamentoMeta, 2);
    expect(r.aporteMensal).toBeCloseTo(pagamentoMeta - parcelaAtual, 2);
    expect(r.aporteMensal).toBeGreaterThan(0);
  });

  it('quitar na meta economiza juros vs o contrato original', () => {
    const r = calcularMetaQuitacao(BASE);
    expect(r.jurosTotais).toBeLessThan(r.jurosOriginais);
    expect(r.economiaJuros).toBeCloseTo(r.jurosOriginais - r.jurosTotais, 2);
    expect(r.economiaJuros).toBeGreaterThan(0);
  });

  it('meta maior ou igual ao prazo não exige aporte', () => {
    const r = calcularMetaQuitacao({ ...BASE, metaMeses: 360 });
    expect(r.aporteMensal).toBeLessThanOrEqual(0);
    expect(r.metaMaiorQuePrazo).toBe(true);
  });

  it('SAC com meta curta pode ter alvo menor que a parcela inicial, sem meta >= prazo', () => {
    const r = calcularMetaQuitacao({ ...BASE, sistema: 'SAC', metaMeses: 180 });
    expect(r.metaMaiorQuePrazo).toBe(false);
    expect(r.pagamentoTotal).toBeLessThan(r.parcelaAtual);
    expect(r.aporteMensal).toBeLessThanOrEqual(0);
  });

  it('SAC usa a parcela inicial como referência', () => {
    const r = calcularMetaQuitacao({ ...BASE, sistema: 'SAC' });
    const i = Math.pow(1.12, 1 / 12) - 1;
    expect(r.parcelaAtual).toBeCloseTo(400000 / 360 + 400000 * i, 2);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularMetaQuitacao({ ...BASE, saldoDevedor: 0 })).toThrow();
    expect(() => calcularMetaQuitacao({ ...BASE, metaMeses: 0 })).toThrow();
    expect(() => calcularMetaQuitacao({ ...BASE, taxaFinanciamento: -0.1 })).toThrow();
  });
});
