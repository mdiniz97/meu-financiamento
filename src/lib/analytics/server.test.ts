import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/db', () => ({
  db: { query: { users: { findFirst: mocks.findFirst } } },
  schema: { users: { id: 'id' } },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

import { captureAccountEvent } from './server';

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_test';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
  mocks.findFirst.mockReset().mockResolvedValue({ analyticsConsent: false });
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  global.fetch = originalFetch;
  if (token === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = token;
  if (host === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  else process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
});

describe('captureAccountEvent', () => {
  it('does not send events for accounts that declined analytics', async () => {
    await captureAccountEvent('u1', 'purchase_confirmed', 'payment-1');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends only account identifier and event for consenting accounts', async () => {
    mocks.findFirst.mockResolvedValue({ analyticsConsent: true });

    await captureAccountEvent('u1', 'purchase_confirmed', 'payment-1');

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://us.i.posthog.com/i/v0/e/');
    const payload = JSON.parse(init!.body as string);
    expect(payload).toMatchObject({
      api_key: 'phc_test',
      distinct_id: 'u1',
      event: 'purchase_confirmed',
    });
    expect(payload.properties.$insert_id).toMatch(/^[a-f0-9]{64}$/);
    expect(init!.body).not.toContain('payment-1');
  });

  it('does not disrupt a completed purchase when analytics is unavailable', async () => {
    mocks.findFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(captureAccountEvent('u1', 'purchase_confirmed', 'payment-1')).resolves.toBeUndefined();
  });
});
