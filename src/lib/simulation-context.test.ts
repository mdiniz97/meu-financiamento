import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORM,
  formToInput,
  formToStrategies,
  parseStoredForm,
} from './simulation-context';

describe('simulation-context', () => {
  it('converte form para LoanInput com valores padrão', () => {
    const input = formToInput(DEFAULT_FORM);
    expect(input.principal).toBe(1000000);
    expect(input.system).toBe('PRICE');
  });
  it('converte estratégias do form', () => {
    const s = formToStrategies({ ...DEFAULT_FORM, lumpSum: [{ month: 12, amount: 5000 }] });
    expect(s.extraLumpSum).toEqual([{ month: 12, amount: 5000 }]);
  });
  it('parseStoredForm sem storage retorna DEFAULT_FORM (não quebra)', () => {
    expect(parseStoredForm(null)).toBe(DEFAULT_FORM);
    expect(parseStoredForm('')).toBe(DEFAULT_FORM);
  });
  it('parseStoredForm com JSON inválido retorna DEFAULT_FORM', () => {
    expect(parseStoredForm('{{lixo')).toBe(DEFAULT_FORM);
  });
  it('parseStoredForm mescla JSON válido sobre DEFAULT_FORM', () => {
    const f = parseStoredForm(JSON.stringify({ principal: '200000' }));
    expect(f.principal).toBe('200000');
    expect(f.system).toBe('PRICE');
    expect(f.months).toBe('360');
  });
  it('formToInput aceita vírgula decimal PT-BR (10,5%)', () => {
    const input = formToInput({ ...DEFAULT_FORM, annualRate: '10,5', trMonthly: '0,17' });
    expect(input.annualRate).toBeCloseTo(0.105);
    expect(input.trMonthly).toBeCloseTo(0.0017);
  });
  it('formToStrategies aceita vírgula decimal na portabilidade', () => {
    const s = formToStrategies({
      ...DEFAULT_FORM,
      portability: { annualRate: '8,5', bank: 'Itaú' },
    });
    expect(s.portability?.annualRate).toBeCloseTo(0.085);
    expect(s.portability?.bank).toBe('Itaú');
    expect(s.portability?.insuranceMonthly).toBe(100);
  });
  it('formToStrategies omite portabilidade inválida (NaN nunca chega no engine)', () => {
    const s = formToStrategies({ ...DEFAULT_FORM, portability: { annualRate: 'abc', bank: 'Itaú' } });
    expect(s.portability).toBeUndefined();
  });
  it('formToStrategies converte aporte recorrente (10 mil a cada 12 meses no mês 6)', () => {
    const s = formToStrategies({
      ...DEFAULT_FORM,
      recurringExtra: { amount: '10000', every: '12', startMonth: '6', untilMonth: '' },
    });
    expect(s.recurringExtra).toEqual({ amount: 10000, every: 12, startMonth: 6 });
  });
  it('formToStrategies omite aporte recorrente inválido', () => {
    const s = formToStrategies({
      ...DEFAULT_FORM,
      recurringExtra: { amount: '0', every: '0', startMonth: '0', untilMonth: '' },
    });
    expect(s.recurringExtra).toBeUndefined();
  });
  it('parseStoredForm antigo sem recurringExtra não quebra', () => {
    const f = parseStoredForm(JSON.stringify({ principal: '300000' }));
    expect(f.recurringExtra).toBeNull();
  });
  it('formToStrategies ativa paySacParcela', () => {
    const s = formToStrategies({ ...DEFAULT_FORM, paySacParcela: true });
    expect(s.paySacParcela).toBe(true);
    expect(formToStrategies(DEFAULT_FORM).paySacParcela).toBeUndefined();
  });
});
