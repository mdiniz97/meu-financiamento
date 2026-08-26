import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, formToInput, formToStrategies } from './simulation-context';

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
});
