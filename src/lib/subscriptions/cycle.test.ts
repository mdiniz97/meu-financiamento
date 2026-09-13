import { describe, expect, it } from 'vitest';
import { addCycle } from './cycle';

describe('addCycle', () => {
  it('YEARLY soma 1 ano', () => {
    expect(addCycle(new Date('2026-03-10T00:00:00Z'), 'YEARLY').toISOString()).toBe(
      '2027-03-10T00:00:00.000Z'
    );
  });
  it('29/02 em ano não bissexto vira 28/02', () => {
    expect(addCycle(new Date('2028-02-29T00:00:00Z'), 'YEARLY').toISOString()).toBe(
      '2029-02-28T00:00:00.000Z'
    );
  });
  it('MONTHLY soma 1 mês', () => {
    expect(addCycle(new Date('2026-01-31T00:00:00Z'), 'MONTHLY').toISOString()).toBe(
      '2026-03-03T00:00:00.000Z'
    );
  });
  it('QUARTERLY soma 3 meses', () => {
    expect(addCycle(new Date('2026-01-15T00:00:00Z'), 'QUARTERLY').toISOString()).toBe(
      '2026-04-15T00:00:00.000Z'
    );
  });
  it('SEMIANNUALLY soma 6 meses', () => {
    expect(addCycle(new Date('2026-01-15T00:00:00Z'), 'SEMIANNUALLY').toISOString()).toBe(
      '2026-07-15T00:00:00.000Z'
    );
  });
  it('ciclo não suportado lança erro', () => {
    expect(() => addCycle(new Date('2026-01-15T00:00:00Z'), 'WEEKLY')).toThrow(
      'cycle não suportado: WEEKLY'
    );
  });
});
