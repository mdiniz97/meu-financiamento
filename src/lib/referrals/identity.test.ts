import { describe, expect, it } from 'vitest';
import { maskReferralEmail, newReferralCode } from './identity';

describe('referral identity', () => {
  it('generates distinct, opaque URL-safe codes', () => {
    const codes = Array.from({ length: 100 }, () => newReferralCode());
    expect(new Set(codes).size).toBe(100);
    for (const code of codes) expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('masks full invited address, including domain', () => {
    expect(maskReferralEmail('fulana.silva@example.com')).toBe('fu***.sil**@***.com');
    expect(maskReferralEmail('a@b.co')).toBe('*@***.co');
    expect(maskReferralEmail('á@x.co')).not.toContain('á@x');
  });
});
