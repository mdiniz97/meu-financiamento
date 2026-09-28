import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createActivationToken, hashActivationToken } from './token';

describe('activation token', () => {
  it('gera token imprevisível de 256 bits e guarda apenas digest SHA-256', () => {
    const first = createActivationToken();
    const second = createActivationToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.hash).toBe(createHash('sha256').update(first.token).digest('hex'));
    expect(first.hash).not.toContain(first.token);
    expect(hashActivationToken(first.token)).toBe(first.hash);
  });

  it('rejeita comprimento e alfabeto inválidos sem buscar no banco', () => {
    expect(hashActivationToken('short')).toBeNull();
    expect(hashActivationToken('x'.repeat(42) + '=')).toBeNull();
    expect(hashActivationToken('x'.repeat(42) + '/')).toBeNull();
    expect(hashActivationToken('x'.repeat(44))).toBeNull();
  });
});
