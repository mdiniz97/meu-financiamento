import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  assertSameOrigin: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/db', () => ({
  db: { query: { users: { findFirst: mocks.findFirst } }, update: mocks.update },
  schema: { users: { id: 'id', analyticsConsent: 'analyticsConsent' } },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/security/same-origin', () => ({ assertSameOrigin: mocks.assertSameOrigin }));

import { GET, POST } from './route';

const request = (consent: unknown) =>
  new Request('http://localhost/api/analytics-consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ consent }),
  });

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: 'u1' });
  mocks.findFirst.mockReset().mockResolvedValue({ analyticsConsent: null });
  mocks.assertSameOrigin.mockReset().mockResolvedValue(undefined);
  mocks.where.mockReset().mockResolvedValue(undefined);
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
});
afterEach(() => vi.unstubAllEnvs());

describe('analytics consent', () => {
  it('requires an authenticated user to persist consent', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST(request(true));

    expect(response.status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects nonboolean consent', async () => {
    const response = await POST(request('yes'));

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('persists opt-in for the authenticated account', async () => {
    const response = await POST(request(true));

    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ analyticsConsent: true });
  });

  it('persists refusal and revocation for the authenticated account', async () => {
    const response = await POST(request(false));
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ analyticsConsent: false });
  });

  it('rejects cross-origin updates before touching the account', async () => {
    mocks.assertSameOrigin.mockRejectedValue(new Error('invalid origin'));
    const response = await POST(request(true));
    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('exposes stored refusal, not a browser-provided preference', async () => {
    mocks.findFirst.mockResolvedValue({ analyticsConsent: false });

    const response = await GET();

    expect(await response.json()).toMatchObject({ userId: 'u1', consent: false });
  });

  it('returns runtime public capture config for anonymous visitors', async () => {
    mocks.auth.mockResolvedValue(null);
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'phc_runtime');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com');

    const response = await GET();
    expect(await response.json()).toEqual({
      userId: null,
      consent: null,
      analytics: { token: 'phc_runtime', host: 'https://us.i.posthog.com' },
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('reads the public token from server runtime even when build-time token is absent', async () => {
    mocks.auth.mockResolvedValue(null);
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '');
    vi.stubEnv('POSTHOG_PROJECT_TOKEN', 'phc_runtime');
    const response = await GET();
    expect((await response.json()).analytics.token).toBe('phc_runtime');
  });
});
