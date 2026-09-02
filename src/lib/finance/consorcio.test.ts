import { describe, expect, it } from 'vitest';
import { calcularConsorcioOuFinanciamento } from './consorcio';

const BASE = {
  valor: 300000,
  prazoMeses: 240,
  taxaAdminPct: 18,
  taxaFinanciamento: 0.12,
};

describe('calcularConsorcioOuFinanciamento', () => {
  it('consórcio: parcela = (crédito + taxa de administração) / prazo', () => {
    const r = calcularConsorcioOuFinanciamento(BASE);
    expect(r.parcelaConsorcio).toBeCloseTo((300000 * 1.18) / 240, 2);
    expect(r.totalConsorcio).toBeCloseTo(300000 * 1.18, 2);
  });

  it('financiamento: parcela PRICE sobre o valor', () => {
    const r = calcularConsorcioOuFinanciamento(BASE);
    const i = Math.pow(1.12, 1 / 12) - 1;
    const parcela = (300000 * i) / (1 - Math.pow(1 + i, -240));
    expect(r.parcelaFinanciamento).toBeCloseTo(parcela, 2);
    expect(r.totalFinanciamento).toBeCloseTo(parcela * 240, 2);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularConsorcioOuFinanciamento({ ...BASE, valor: 0 })).toThrow();
    expect(() => calcularConsorcioOuFinanciamento({ ...BASE, prazoMeses: 0 })).toThrow();
    expect(() => calcularConsorcioOuFinanciamento({ ...BASE, taxaAdminPct: -1 })).toThrow();
    expect(() => calcularConsorcioOuFinanciamento({ ...BASE, taxaFinanciamento: -0.1 })).toThrow();
  });
});
