import { describe, expect, it } from 'vitest';
import { simulate, validateLoanInput } from './engine';
import type { LoanInput, Strategies } from './types';

const validInput: LoanInput = {
  system: 'PRICE',
  principal: 200000,
  annualRate: 0.1055,
  months: 360,
  trMonthly: 0.0017,
  insuranceMonthly: 120,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
  bank: 'Caixa',
};
const validStrategies: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('validateLoanInput', () => {
  it('aceita input válido', () => {
    expect(() => validateLoanInput(validInput, validStrategies)).not.toThrow();
  });

  it('rejeita principal <= 0 e não finito', () => {
    expect(() => validateLoanInput({ ...validInput, principal: 0 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, principal: -100 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, principal: NaN })).toThrow('input inválido');
  });

  it('rejeita months fora de 1..600 e não finito', () => {
    expect(() => validateLoanInput({ ...validInput, months: 0 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, months: 601 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, months: Infinity })).toThrow('input inválido');
  });

  it('rejeita taxas fora da faixa', () => {
    expect(() => validateLoanInput({ ...validInput, annualRate: -0.1 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, annualRate: 1.5 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, trMonthly: 0.5 })).toThrow('input inválido');
    expect(() => validateLoanInput({ ...validInput, trMonthly: NaN })).toThrow('input inválido');
  });

  it('rejeita seguro negativo', () => {
    expect(() => validateLoanInput({ ...validInput, insuranceMonthly: -1 })).toThrow('input inválido');
  });

  it('rejeita sistema inválido', () => {
    expect(() =>
      validateLoanInput({ ...validInput, system: 'X' as LoanInput['system'] })
    ).toThrow('input inválido');
  });

  it('rejeita estratégias inválidas', () => {
    expect(() =>
      validateLoanInput(validInput, { extraLumpSum: [{ month: NaN, amount: 100 }], reduceMode: 'term' })
    ).toThrow('input inválido');
    expect(() =>
      validateLoanInput(validInput, { extraLumpSum: [{ month: 12, amount: -5 }], reduceMode: 'term' })
    ).toThrow('input inválido');
    expect(() => validateLoanInput(validInput, { extraLumpSum: [], reduceMode: 'x' as 'term' })).toThrow(
      'input inválido'
    );
    expect(() =>
      validateLoanInput(validInput, { ...validStrategies, extraMonthlyPct: 1.5 })
    ).toThrow('input inválido');
  });

  it('simulate rejeita input malicioso sem pendurar', () => {
    expect(() => simulate({ ...validInput, months: 1e999 })).toThrow('input inválido');
    expect(() => simulate({ ...validInput, principal: NaN })).toThrow('input inválido');
  });
});
