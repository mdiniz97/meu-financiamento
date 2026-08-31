import { describe, expect, it } from 'vitest';
import { validateLoanInput } from './finance/engine';
import { clampStrategyUntilMonths } from './finance/strategy-rows';
import {
  DEFAULT_FORM,
  formToInput,
  formToStrategies,
  parseStoredForm,
} from './simulation-context';

const SEMANTICALLY_INVALID_STORED_FORMS = [
  { name: 'principal zero', stored: { principal: '0' } },
  { name: 'taxa anual acima de 100%', stored: { annualRate: '101' } },
  { name: 'TR acima de 10%', stored: { trMonthly: '10.01' } },
  { name: 'prazo acima de 600', stored: { months: '601' } },
  { name: 'seguro negativo', stored: { insuranceMonthly: '-1' } },
  { name: 'percentual extra acima de 100%', stored: { extraMonthlyPct: '101' } },
  {
    name: 'aporte pontual após contrato',
    stored: { months: '12', lumpSum: [{ month: 13, amount: 5000 }] },
  },
  {
    name: 'percentual com janela após contrato',
    stored: { months: '12', extraMonthlyPct: '5', extraMonthlyPctStart: '13' },
  },
  {
    name: 'percentual com mês em notação não decimal',
    stored: { months: '10', extraMonthlyPct: '5', extraMonthlyPctStart: '1e1' },
  },
  {
    name: 'recorrente com janela após contrato',
    stored: {
      months: '12',
      recurringExtra: { amount: '1000', every: '2', startMonth: '13', untilMonth: '' },
    },
  },
  {
    name: 'pagamento fixo com janela após contrato',
    stored: { months: '12', fixedPayment: '5000', fixedPaymentStart: '13' },
  },
  {
    name: 'FGTS com janela após contrato',
    stored: { months: '12', fgtsAnnual: '10000', fgtsStartMonth: '13' },
  },
  {
    name: 'estratégias com valores e modos inválidos',
    stored: {
      lumpSum: [{ month: 12, amount: -1, reduceMode: 'both' }],
      recurringExtra: { amount: '-1', every: '0', startMonth: '0', untilMonth: '' },
      fixedPayment: '-1',
      fgtsAnnual: '-1',
      reduceMode: 'both',
    },
  },
] as const;

function expectAcceptedByLoanValidator(form: ReturnType<typeof parseStoredForm>) {
  expect(() => validateLoanInput(formToInput(form), formToStrategies(form))).not.toThrow();
}

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
  it('parseStoredForm sem storage retorna cópia nova do DEFAULT_FORM', () => {
    const form = parseStoredForm(null);
    expect(form).toEqual(DEFAULT_FORM);
    expect(form).not.toBe(DEFAULT_FORM);
    expect(form.lumpSum).not.toBe(DEFAULT_FORM.lumpSum);
    expect(parseStoredForm('')).toEqual(DEFAULT_FORM);
  });
  it('parseStoredForm com JSON inválido retorna DEFAULT_FORM', () => {
    expect(parseStoredForm('{{lixo')).toEqual(DEFAULT_FORM);
  });
  it('parseStoredForm mescla JSON válido sobre DEFAULT_FORM', () => {
    const f = parseStoredForm(JSON.stringify({ principal: '200000' }));
    expect(f.principal).toBe('200000');
    expect(f.system).toBe('PRICE');
    expect(f.months).toBe('360');
    expect(f.annualRateKind).toBe('effective-annual');
  });
  it('parseStoredForm troca tipo de taxa inválido pelo padrão seguro', () => {
    const f = parseStoredForm(JSON.stringify({ annualRate: '12', annualRateKind: 'monthly' }));
    expect(f.annualRate).toBe('12');
    expect(f.annualRateKind).toBe('effective-annual');
  });
  it('descarta escalares com tipos inválidos e campos desconhecidos', () => {
    const form = parseStoredForm(JSON.stringify({
      system: 'ALEATÓRIO',
      principal: 200000,
      annualRate: 12,
      annualRateKind: 'monthly',
      months: 240,
      trMonthly: 0.2,
      insuranceMonthly: 150,
      bank: 42,
      extraMonthlyPct: 5,
      extraMonthlyPctStart: 2,
      extraMonthlyPctUntil: 100,
      fixedPaymentStart: 3,
      fgtsAnnual: 10000,
      fgtsStartMonth: 12,
      fgtsUntilMonth: 120,
      fixedPayment: 4000,
      fixedPaymentUntil: 60,
      paySacParcela: 'true',
      reduceMode: 'both',
      costs: '99999,00',
    }));

    expect(form).toEqual(DEFAULT_FORM);
    expect(form).not.toHaveProperty('costs');
    expect(() => formToInput(form)).not.toThrow();
    expect(() => formToStrategies(form)).not.toThrow();
    expectAcceptedByLoanValidator(form);
  });
  it.each([
    {},
    'aporte',
    [null],
    [{ month: '12', amount: 5000 }],
    [{ month: 12, amount: '5000' }],
    [{ month: 12, amount: 5000, reduceMode: 'both' }],
  ])('descarta array de aportes malformado: %j', (lumpSum) => {
    const form = parseStoredForm(JSON.stringify({ lumpSum }));
    expect(form.lumpSum).toEqual([]);
    expect(() => formToStrategies(form)).not.toThrow();
    expectAcceptedByLoanValidator(form);
  });
  it.each([
    'recorrente',
    [],
    {},
    { amount: 10000, every: 12, startMonth: 6, untilMonth: 120 },
  ])('descarta aporte recorrente malformado: %j', (recurringExtra) => {
    const form = parseStoredForm(JSON.stringify({ recurringExtra }));
    expect(form.recurringExtra).toBeNull();
    expect(() => formToStrategies(form)).not.toThrow();
    expectAcceptedByLoanValidator(form);
  });
  it.each([
    'portabilidade',
    [],
    {},
    { annualRate: '8', annualRateKind: 'effective-annual' },
    { annualRate: 8, annualRateKind: 'effective-annual', bank: 'Itaú' },
    { annualRate: '8', annualRateKind: 'monthly', bank: 'Itaú' },
    { annualRate: '8', annualRateKind: 'effective-annual', bank: [] },
  ])('descarta portabilidade malformada: %j', (portability) => {
    const form = parseStoredForm(JSON.stringify({ portability }));
    expect(form.portability).toBeNull();
    expect(() => formToStrategies(form)).not.toThrow();
    expect(formToStrategies(form).portability).toBeUndefined();
    expectAcceptedByLoanValidator(form);
  });
  it('preserva aporte recorrente histórico sem untilMonth', () => {
    const form = parseStoredForm(JSON.stringify({
      recurringExtra: { amount: '10000', every: '12', startMonth: '6' },
    }));

    expect(form.recurringExtra).toEqual({
      amount: '10000',
      every: '12',
      startMonth: '6',
      untilMonth: '',
    });
    expect(formToStrategies(form).recurringExtra).toEqual({
      amount: 10000,
      every: 12,
      startMonth: 6,
    });
  });
  it('preserva portabilidade histórica sem annualRateKind como efetiva anual', () => {
    const form = parseStoredForm(JSON.stringify({
      portability: { annualRate: '8,5', bank: 'Itaú' },
    }));

    expect(form.portability).toEqual({
      annualRate: '8,5',
      annualRateKind: 'effective-annual',
      bank: 'Itaú',
    });
    expect(formToStrategies(form).portability?.annualRate).toBeCloseTo(0.085);
  });
  it('preserva e converte portabilidade válida a 0%', () => {
    const form = parseStoredForm(JSON.stringify({
      portability: { annualRate: '0', annualRateKind: 'effective-annual', bank: 'Itaú' },
    }));
    expect(form.portability).toEqual({
      annualRate: '0',
      annualRateKind: 'effective-annual',
      bank: 'Itaú',
    });
    expect(formToStrategies(form).portability?.annualRate).toBe(0);
  });
  it('sanitiza campos base inválidos sem perder campos válidos', () => {
    const form = parseStoredForm(JSON.stringify({
      system: 'SAC',
      principal: '0',
      annualRate: '101',
      months: '601',
      trMonthly: '10.01',
      insuranceMonthly: '-1',
      bank: 'Itaú',
    }));

    expect(form).toMatchObject({
      system: 'SAC',
      principal: DEFAULT_FORM.principal,
      annualRate: DEFAULT_FORM.annualRate,
      months: DEFAULT_FORM.months,
      trMonthly: DEFAULT_FORM.trMonthly,
      insuranceMonthly: DEFAULT_FORM.insuranceMonthly,
      bank: 'Itaú',
    });
  });
  it('descarta grupos de estratégia inválidos para o prazo preservando base válida', () => {
    const form = parseStoredForm(JSON.stringify({
      system: 'SAC',
      bank: 'Itaú',
      months: '24',
      lumpSum: [{ month: 25, amount: 5000 }],
      extraMonthlyPct: '101',
      extraMonthlyPctStart: '25',
      extraMonthlyPctUntil: '2',
      fgtsAnnual: '10000',
      fgtsStartMonth: '25',
      fgtsUntilMonth: '',
      recurringExtra: { amount: '3000', every: '6', startMonth: '25', untilMonth: '' },
      fixedPayment: '5000',
      fixedPaymentStart: '25',
      fixedPaymentUntil: '',
      portability: { annualRate: '101', annualRateKind: 'effective-annual', bank: 'Itaú' },
    }));

    expect(form).toMatchObject({ system: 'SAC', bank: 'Itaú', months: '24' });
    expect(form.lumpSum).toEqual([]);
    expect(form.extraMonthlyPct).toBe(DEFAULT_FORM.extraMonthlyPct);
    expect(form.extraMonthlyPctStart).toBe(DEFAULT_FORM.extraMonthlyPctStart);
    expect(form.extraMonthlyPctUntil).toBe(DEFAULT_FORM.extraMonthlyPctUntil);
    expect(form.fgtsAnnual).toBe(DEFAULT_FORM.fgtsAnnual);
    expect(form.recurringExtra).toBeNull();
    expect(form.fixedPayment).toBe(DEFAULT_FORM.fixedPayment);
    expect(form.portability).toBeNull();
  });
  it('descarta janelas de estratégia invertidas', () => {
    const form = parseStoredForm(JSON.stringify({
      months: '24',
      extraMonthlyPct: '5',
      extraMonthlyPctStart: '12',
      extraMonthlyPctUntil: '6',
      fgtsAnnual: '10000',
      fgtsStartMonth: '12',
      fgtsUntilMonth: '6',
      recurringExtra: { amount: '3000', every: '6', startMonth: '12', untilMonth: '6' },
      fixedPayment: '5000',
      fixedPaymentStart: '12',
      fixedPaymentUntil: '6',
    }));

    expect(form.extraMonthlyPct).toBe('0');
    expect(form.fgtsAnnual).toBe('0');
    expect(form.recurringExtra).toBeNull();
    expect(form.fixedPayment).toBe('');
  });
  it('recupera finais legados após o prazo para clamp posterior sem recuperar inícios', () => {
    const form = parseStoredForm(JSON.stringify({
      months: '24',
      extraMonthlyPct: '5',
      extraMonthlyPctStart: '2',
      extraMonthlyPctUntil: '36',
      fgtsAnnual: '10000',
      fgtsStartMonth: '3',
      fgtsUntilMonth: '36',
      recurringExtra: { amount: '3000', every: '6', startMonth: '4', untilMonth: '36' },
      fixedPayment: '5000',
      fixedPaymentStart: '5',
      fixedPaymentUntil: '36',
    }));

    expect(form.extraMonthlyPctUntil).toBe('36');
    expect(form.fgtsUntilMonth).toBe('36');
    expect(form.recurringExtra?.untilMonth).toBe('36');
    expect(form.fixedPaymentUntil).toBe('36');
    expect(clampStrategyUntilMonths(formToStrategies(form), 24)).toMatchObject({
      extraMonthlyPct: 0.05,
      extraMonthlyPctStartMonth: 2,
      extraMonthlyPctUntilMonth: 24,
      fgtsAnnual: { amount: 10000, startMonth: 3, untilMonth: 24 },
      recurringExtra: { amount: 3000, every: 6, startMonth: 4, untilMonth: 24 },
      fixedPayment: { amount: 5000, startMonth: 5, untilMonth: 24 },
    });

    const invalidStart = parseStoredForm(JSON.stringify({
      months: '24',
      extraMonthlyPct: '5',
      extraMonthlyPctStart: '25',
      extraMonthlyPctUntil: '36',
    }));
    expect(formToStrategies(invalidStart).extraMonthlyPct).toBeUndefined();
  });
  it.each(SEMANTICALLY_INVALID_STORED_FORMS)(
    'sempre produz configuração aceita por validateLoanInput: $name',
    ({ stored }) => {
      const form = parseStoredForm(JSON.stringify(stored));
      expectAcceptedByLoanValidator(form);
    }
  );
  it('preserva estratégias persistidas com formatos válidos', () => {
    const form = parseStoredForm(JSON.stringify({
      lumpSum: [{ month: 12, amount: 5000, reduceMode: 'payment' }],
      recurringExtra: { amount: '10000', every: '12', startMonth: '6', untilMonth: '120' },
      paySacParcela: true,
      reduceMode: 'payment',
      portability: { annualRate: '8', annualRateKind: 'effective-annual', bank: 'Itaú' },
    }));

    expect(form.lumpSum).toEqual([{ month: 12, amount: 5000, reduceMode: 'payment' }]);
    expect(form.recurringExtra).toEqual({ amount: '10000', every: '12', startMonth: '6', untilMonth: '120' });
    expect(form.paySacParcela).toBe(true);
    expect(form.reduceMode).toBe('payment');
    expect(form.portability).toEqual({ annualRate: '8', annualRateKind: 'effective-annual', bank: 'Itaú' });
  });
  it('preserva FormState atual completo quando semanticamente seguro', () => {
    const current = {
      ...DEFAULT_FORM,
      system: 'SAC' as const,
      principal: '750000,00',
      annualRate: '12',
      annualRateKind: 'nominal-annual' as const,
      months: '240',
      trMonthly: '0,2',
      insuranceMonthly: '250,00',
      bank: 'Itaú',
      lumpSum: [{ month: 24, amount: 5000, reduceMode: 'payment' as const }],
      extraMonthlyPct: '10',
      extraMonthlyPctStart: '2',
      extraMonthlyPctUntil: '120',
      fgtsAnnual: '10000,00',
      fgtsStartMonth: '12',
      fgtsUntilMonth: '120',
      recurringExtra: { amount: '3000,00', every: '6', startMonth: '3', untilMonth: '120' },
      fixedPayment: '5000,00',
      fixedPaymentStart: '2',
      fixedPaymentUntil: '120',
      paySacParcela: true,
      reduceMode: 'payment' as const,
      portability: { annualRate: '8,5', annualRateKind: 'effective-annual' as const, bank: 'Bradesco' },
    };

    expect(parseStoredForm(JSON.stringify(current))).toEqual(current);
  });
  it('formToInput aceita vírgula decimal PT-BR (10,5%)', () => {
    const input = formToInput({ ...DEFAULT_FORM, annualRate: '10,5', trMonthly: '0,17' });
    expect(input.annualRate).toBeCloseTo(0.105);
    expect(input.trMonthly).toBeCloseTo(0.0017);
  });
  it('normaliza taxa nominal antes de criar LoanInput', () => {
    const input = formToInput({
      ...DEFAULT_FORM,
      annualRate: '12',
      annualRateKind: 'nominal-annual',
    });
    expect(input.annualRate).toBeCloseTo(1.01 ** 12 - 1, 12);
  });
  it('formToStrategies aceita vírgula decimal na portabilidade', () => {
    const s = formToStrategies({
      ...DEFAULT_FORM,
      portability: { annualRate: '8,5', annualRateKind: 'effective-annual', bank: 'Itaú' },
    });
    expect(s.portability?.annualRate).toBeCloseTo(0.085);
    expect(s.portability?.bank).toBe('Itaú');
    expect(s.portability?.insuranceMonthly).toBe(100);
  });
  it('formToStrategies omite portabilidade inválida (NaN nunca chega no engine)', () => {
    const s = formToStrategies({ ...DEFAULT_FORM, portability: { annualRate: 'abc', annualRateKind: 'effective-annual', bank: 'Itaú' } });
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
