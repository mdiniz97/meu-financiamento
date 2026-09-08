import { describe, expect, it } from 'vitest';
import { calcularConsorcioOuInvestir } from './consorcio-investir';

const BASE = {
  valor: 300000,
  prazoMeses: 240,
  taxaAdminPct: 18,
  selicAnual: 0.105,
};

describe('calcularConsorcioOuInvestir', () => {
  it('calcula parcela com taxa de administração diluída', () => {
    const r = calcularConsorcioOuInvestir(BASE);
    expect(r.totalConsorcio).toBeCloseTo(354000, 2);
    expect(r.parcelaMensal).toBeCloseTo(1475, 2);
    expect(r.custoAdministracao).toBeCloseTo(54000, 2);
  });

  it('Selic de 10,5% a.a. compra no mês 120 com aportes no fim do mês', () => {
    const r = calcularConsorcioOuInvestir(BASE);
    // FV = 1475 * ((1 + i)^n - 1) / i: mês 119 = 298629,80; mês 120 = 302599,90.
    expect(r.mesCompraAvista).toBe(120);
    expect(r.mesCompraAvistaAnos).toBe(10);
  });

  it('com Selic zero, investir atinge o valor em prazo/(1+taxa)', () => {
    const r = calcularConsorcioOuInvestir({ ...BASE, selicAnual: 0 });
    expect(r.mesCompraAvista).toBe(204);
    expect(r.mesCompraAvista).toBeLessThan(r.prazoMeses);
  });

  it.each([1, 7, 180, 240, 600])('sem taxa de administração e sem Selic, empata em %i meses', (prazoMeses) => {
    const r = calcularConsorcioOuInvestir({ ...BASE, prazoMeses, taxaAdminPct: 0, selicAnual: 0 });
    expect(r.mesCompraAvista).toBe(prazoMeses);
  });

  it('tolera erro de acumulação também quando a meta antecede o fim do prazo', () => {
    const r = calcularConsorcioOuInvestir({ valor: 100000, prazoMeses: 360, taxaAdminPct: 25, selicAnual: 0 });
    // 360 / 1,25 = 288 aportes, sem rendimento.
    expect(r.mesCompraAvista).toBe(288);
  });

  it('atinge a meta sem juros em 457 meses mesmo com crédito alto', () => {
    const r = calcularConsorcioOuInvestir({ valor: 99999999999, prazoMeses: 457, taxaAdminPct: 0, selicAnual: 0 });
    expect(r.mesCompraAvista).toBe(457);
  });

  it.each([
    { valor: 100000, taxaAdminPct: 99.99998 },
    { valor: 99999999999, taxaAdminPct: 99.99999999998002 },
  ])('não antecipa a compra quando falta um centavo de $valor', ({ valor, taxaAdminPct }) => {
    const r = calcularConsorcioOuInvestir({ valor, prazoMeses: 600, taxaAdminPct, selicAnual: 0 });
    // As 300 primeiras parcelas somam valor - R$ 0,01, ainda abaixo da meta.
    expect(r.mesCompraAvista).toBe(301);
  });

  it('valida entradas', () => {
    expect(() => calcularConsorcioOuInvestir({ ...BASE, valor: 0 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, prazoMeses: 0 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, taxaAdminPct: -1 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, selicAnual: -1 })).toThrow();
  });

  it.each(['valor', 'prazoMeses', 'taxaAdminPct', 'selicAnual'] as const)('rejeita valores não finitos em %s', (field) => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => calcularConsorcioOuInvestir({ ...BASE, [field]: value })).toThrow();
    }
  });

  it('rejeita prazo fracionário', () => {
    expect(() => calcularConsorcioOuInvestir({ ...BASE, prazoMeses: 1.5 })).toThrow();
  });

  it.each([
    { taxaAdminPct: 1e308 },
    { valor: 1e308, prazoMeses: 2, taxaAdminPct: 0, selicAnual: 1e308 },
    { valor: Number.MIN_VALUE, taxaAdminPct: 0 },
  ])('rejeita resultados não representáveis com entradas finitas: %j', (input) => {
    expect(() => calcularConsorcioOuInvestir({ ...BASE, ...input })).toThrow();
  });
});
