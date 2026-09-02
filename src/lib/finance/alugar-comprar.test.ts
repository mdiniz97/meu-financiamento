import { describe, expect, it } from 'vitest';
import { calcularAlugarOuComprar } from './alugar-comprar';

const BASE = {
  imovelValor: 500000,
  entrada: 100000,
  aluguelMensal: 2500,
  taxaFinanciamento: 0.12,
  selicAnual: 0.14,
  valorizacaoAnual: 0.04,
  prazoMeses: 120,
  mesesFinanciamento: 360,
};

describe('calcularAlugarOuComprar', () => {
  it('calcula parcela e o patrimônio em cada cenário no fim do horizonte', () => {
    const r = calcularAlugarOuComprar(BASE);
    const i = Math.pow(1.12, 1 / 12) - 1;
    const parcela = (400000 * i) / (1 - Math.pow(1 + i, -360));
    expect(r.parcela).toBeCloseTo(parcela, 2);
    expect(r.patrimonioCompra).toBeDefined();
    expect(r.patrimonioAluguel).toBeDefined();
    expect(r.monthly).toHaveLength(120);
  });

  it('comprar gera patrimônio crescente (imóvel − dívida)', () => {
    const r = calcularAlugarOuComprar(BASE);
    expect(r.monthly[119].patrimonioCompra).toBeGreaterThan(0);
    expect(r.patrimonioCompra).toBeCloseTo(r.monthly[119].patrimonioCompra, 2);
  });

  it('alugar investe a entrada e a diferença de desembolso na Selic', () => {
    const r = calcularAlugarOuComprar(BASE);
    expect(r.patrimonioAluguel).toBeGreaterThan(BASE.entrada);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularAlugarOuComprar({ ...BASE, imovelValor: 0 })).toThrow();
    expect(() => calcularAlugarOuComprar({ ...BASE, entrada: 600000 })).toThrow();
    expect(() => calcularAlugarOuComprar({ ...BASE, aluguelMensal: -1 })).toThrow();
    expect(() => calcularAlugarOuComprar({ ...BASE, prazoMeses: 0 })).toThrow();
  });
});
