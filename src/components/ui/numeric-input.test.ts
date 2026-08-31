import { describe, expect, it } from 'vitest';
import { parseIntStrict } from './numeric-input';

describe('parseIntStrict', () => {
  it('aceita apenas inteiros não negativos completos', () => {
    expect(parseIntStrict('360')).toBe(360);
    expect(parseIntStrict(' 12 ')).toBe(12);
    expect(parseIntStrict('0')).toBe(0);
  });

  it('rejeita frações, sufixos e sinais', () => {
    expect(parseIntStrict('12.5')).toBeNaN();
    expect(parseIntStrict('360abc')).toBeNaN();
    expect(parseIntStrict('-12')).toBeNaN();
    expect(parseIntStrict('')).toBeNaN();
  });
});
