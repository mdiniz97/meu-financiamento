import { describe, expect, it } from 'vitest';
import { shouldLockMeuFinanciamento, shouldShowOnboarding } from './access';

describe('Meu financiamento access', () => {
  it('locks users without unlimited and without a contract', () => {
    expect(shouldLockMeuFinanciamento({ isUnlimited: false, hasContract: false })).toBe(true);
  });

  it('does not lock unlimited users without a contract', () => {
    expect(shouldLockMeuFinanciamento({ isUnlimited: true, hasContract: false })).toBe(false);
  });

  it('does not replace the frozen dashboard for non-unlimited users with a contract', () => {
    expect(shouldLockMeuFinanciamento({ isUnlimited: false, hasContract: true })).toBe(false);
  });

  it('shows onboarding only for unlimited users without a contract or loaded state', () => {
    expect(shouldShowOnboarding({ isUnlimited: true, hasContract: false, hasState: false })).toBe(true);
    expect(shouldShowOnboarding({ isUnlimited: true, hasContract: true, hasState: false })).toBe(false);
    expect(shouldShowOnboarding({ isUnlimited: true, hasContract: false, hasState: true })).toBe(false);
    expect(shouldShowOnboarding({ isUnlimited: false, hasContract: false, hasState: false })).toBe(false);
  });
});
