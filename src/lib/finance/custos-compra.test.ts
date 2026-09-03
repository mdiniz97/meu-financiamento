import { describe, expect, it } from 'vitest';
import { calcularCustosCompra, UF_CUSTOS } from './custos-compra';

const BASE = { valorImovel: 500000, entradaPct: 20, uf: 'SP', custosExtras: 3000 };

describe('calcularCustosCompra', () => {
  it('calcula entrada, ITBI, registro e total', () => {
    const r = calcularCustosCompra(BASE);
    expect(r.entrada).toBeCloseTo(100000, 2);
    expect(r.financiado).toBeCloseTo(400000, 2);
    expect(r.itbi).toBeCloseTo(15000, 2);
    expect(r.registro).toBeCloseTo(7500, 2);
    expect(r.totalDesembolso).toBeCloseTo(125500, 2);
  });

  it('usa percentuais de ITBI do estado selecionado', () => {
    expect(UF_CUSTOS.SP.itbi).toBe(3);
    expect(UF_CUSTOS.RJ.itbi).toBe(2);
    const rj = calcularCustosCompra({ ...BASE, uf: 'RJ' });
    expect(rj.itbi).toBeCloseTo(10000, 2);
  });

  it('valida entradas', () => {
    expect(() => calcularCustosCompra({ ...BASE, valorImovel: 0 })).toThrow();
    expect(() => calcularCustosCompra({ ...BASE, entradaPct: 2 })).toThrow();
    expect(() => calcularCustosCompra({ ...BASE, uf: 'XX' })).toThrow();
    expect(() => calcularCustosCompra({ ...BASE, custosExtras: -1 })).toThrow();
  });
});
