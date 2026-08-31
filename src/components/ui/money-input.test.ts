import { describe, expect, it } from 'vitest';
import { isMoneyValueWithinDigitLimit } from './money-input';

describe('MoneyInput controlled validity', () => {
  it('mantém valor externo oversize inválido', () => {
    expect(isMoneyValueWithinDigitLimit(123_456_789_012.34, 13)).toBe(false);
  });

  it('reavalia validade quando maxDigits diminui', () => {
    expect(isMoneyValueWithinDigitLimit(1234.56, 6)).toBe(true);
    expect(isMoneyValueWithinDigitLimit(1234.56, 5)).toBe(false);
  });
});
