import { describe, expect, it } from 'vitest';
import { numberToBRLInput, parseBRLToNumber } from './utils';

describe('numberToBRLInput', () => {
  it.each([1.23, 123456.78, 0])('preserva %s no round trip do parser BRL', (value) => {
    expect(parseBRLToNumber(numberToBRLInput(value))).toBe(value);
  });
});
