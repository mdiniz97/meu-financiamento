import { describe, expect, it } from 'vitest';
import { getVisitorIdentity, isTrackingAllowed } from './identity';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe('tracking identity', () => {
  it('keeps pseudonymous visitor stable across visits up to 30 days', () => {
    const store = storage();
    expect(getVisitorIdentity(store, 0, () => 'a')).toBe('anon:a');
    expect(getVisitorIdentity(store, 29 * 86_400_000, () => 'b')).toBe('anon:a');
    expect(getVisitorIdentity(store, 30 * 86_400_000, () => 'b')).toBe('anon:b');
  });

  it('honors both previous browser refusal and account opt-out', () => {
    expect(isTrackingAllowed(null, null)).toBe(true);
    expect(isTrackingAllowed(false, null)).toBe(false);
    expect(isTrackingAllowed(null, 'declined')).toBe(false);
    expect(isTrackingAllowed(true, 'declined')).toBe(false);
  });
});
