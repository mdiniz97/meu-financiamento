import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertSameOrigin: vi.fn(),
  ackSignupConversion: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/security/same-origin', () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock('@/lib/ads/signup-conversion-store', () => ({ ackSignupConversion: mocks.ackSignupConversion }));

import { POST } from './route';

const TOKEN = '611a98f0-bb03-447e-a0e5-e55492c60c4f';
const request = (body: unknown) => new Request('http://localhost/api/ads/signup-conversion/ack', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: 'user-1' });
  mocks.assertSameOrigin.mockReset().mockResolvedValue(undefined);
  mocks.ackSignupConversion.mockReset().mockResolvedValue(false);
});

describe('POST /api/ads/signup-conversion/ack', () => {
  it('requires authenticated account', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request({ claimToken: TOKEN }));
    expect(response.status).toBe(401);
    expect(mocks.ackSignupConversion).not.toHaveBeenCalled();
  });

  it('rejects cross-origin mutation', async () => {
    mocks.assertSameOrigin.mockRejectedValue(new Error('invalid origin'));
    const response = await POST(request({ claimToken: TOKEN }));
    expect(response.status).toBe(403);
    expect(mocks.ackSignupConversion).not.toHaveBeenCalled();
  });

  it('rejects malformed lease token', async () => {
    const response = await POST(request({ claimToken: 'invalid' }));
    expect(response.status).toBe(400);
    expect(mocks.ackSignupConversion).not.toHaveBeenCalled();
  });

  it('does not confirm a foreign or expired lease', async () => {
    const response = await POST(request({ claimToken: TOKEN, userId: 'another-user' }));
    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.ackSignupConversion).toHaveBeenCalledWith('user-1', TOKEN);
  });

  it('confirms a valid lease once', async () => {
    mocks.ackSignupConversion.mockResolvedValue(true);
    const response = await POST(request({ claimToken: TOKEN }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acknowledged: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
