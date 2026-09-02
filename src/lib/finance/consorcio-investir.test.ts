import { describe, expect, it } from 'vitest';
import { calcularConsorcioOuInvestir } from './consorcio-investir';

const BASE = {
  valor: 300000,
  prazoMeses: 240,
  taxaAdminPct: 18,
  selicAnual: 10.5,
};

describe('calcularConsorcioOuInvestir', () => {
  it('calcula parcela com taxa de administração diluída', () => {
    const r = calcularConsorcioOuInvestir(BASE);
    expect(r.totalConsorcio).toBeCloseTo(354000, 2);
    expect(r.parcelaMensal).toBeCloseTo(1475, 2);
    expect(r.custoAdministracao).toBeCloseTo(54000, 2);
  });

  it('com Selic alta, investir junta o valor antes do fim do prazo', () => {
    const r = calcularConsorcioOuInvestir(BASE);
    expect(r.mesCompraAvista).toBeLessThan(r.prazoMeses);
  });

  it('com Selic zero, investir atinge o valor em prazo/(1+taxa)', () => {
    const r = calcularConsorcioOuInvestir({ ...BASE, selicAnual: 0 });
    expect(r.mesCompraAvista).toBe(204);
    expect(r.mesCompraAvista).toBeLessThan(r.prazoMeses);
  });

  it('sem taxa de administração e sem Selic, empata no fim do prazo', () => {
    const r = calcularConsorcioOuInvestir({ ...BASE, taxaAdminPct: 0, selicAnual: 0 });
    expect(r.mesCompraAvista).toBe(240);
  });

  it('valida entradas', () => {
    expect(() => calcularConsorcioOuInvestir({ ...BASE, valor: 0 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, prazoMeses: 0 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, taxaAdminPct: -1 })).toThrow();
    expect(() => calcularConsorcioOuInvestir({ ...BASE, selicAnual: -1 })).toThrow();
  });
});
