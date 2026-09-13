import { describe, expect, it } from 'vitest';
import { parseAsaasEvent, verifyAsaasToken } from './webhook';

describe('verifyAsaasToken', () => {
  it('aceita token igual', () => {
    expect(verifyAsaasToken('abc123', 'abc123')).toBe(true);
  });
  it('rejeita diferente, nulo ou vazio', () => {
    expect(verifyAsaasToken('abc124', 'abc123')).toBe(false);
    expect(verifyAsaasToken(null, 'abc123')).toBe(false);
    expect(verifyAsaasToken('', 'abc123')).toBe(false);
  });
});

describe('parseAsaasEvent', () => {
  it('aceita só id+event e ignora campos desconhecidos', () => {
    const evt = parseAsaasEvent(JSON.stringify({ id: 'evt_1', event: 'PAYMENT_CONFIRMED', novo: { x: 1 } }));
    expect(evt).toMatchObject({ id: 'evt_1', event: 'PAYMENT_CONFIRMED' });
  });
  it('rejeita json inválido ou sem id/event', () => {
    expect(parseAsaasEvent('{')).toBeNull();
    expect(parseAsaasEvent(JSON.stringify({ event: 'X' }))).toBeNull();
    expect(parseAsaasEvent(JSON.stringify({ id: 'evt_1' }))).toBeNull();
  });
});
