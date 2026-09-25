import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertSameOrigin: vi.fn(),
  claimSignupConversion: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/security/same-origin', () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock('@/lib/ads/signup-conversion-store', () => ({ claimSignupConversion: mocks.claimSignupConversion }));

import { POST } from './route';

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: 'user-1' });
  mocks.assertSameOrigin.mockReset().mockResolvedValue(undefined);
  mocks.claimSignupConversion.mockReset().mockResolvedValue(null);
});

describe('POST /api/ads/signup-conversion/claim', () => {
  it('requires authenticated account', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST();
    expect(response.status).toBe(401);
    expect(mocks.claimSignupConversion).not.toHaveBeenCalled();
  });

  it('rejects cross-origin mutation before claiming', async () => {
    mocks.assertSameOrigin.mockRejectedValue(new Error('invalid origin'));
    const response = await POST();
    expect(response.status).toBe(403);
    expect(mocks.claimSignupConversion).not.toHaveBeenCalled();
  });

  it('has no conversion for a pre-existing or already-sent account', async () => {
    const response = await POST();
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.claimSignupConversion).toHaveBeenCalledWith('user-1');
  });

  it('returns only transaction ID and lease token for the current account', async () => {
    mocks.claimSignupConversion.mockResolvedValue({
      transactionId: 'TID_42',
      claimToken: '611a98f0-bb03-447e-a0e5-e55492c60c4f',
    });
    const response = await POST();
    expect(await response.json()).toEqual({
      transactionId: 'TID_42',
      claimToken: '611a98f0-bb03-447e-a0e5-e55492c60c4f',
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
