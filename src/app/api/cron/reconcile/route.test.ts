import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));
vi.mock('@/lib/subscriptions/reconcile', () => ({ reconcileSubscriptions: mocks.reconcile }));

import { GET, POST } from './route';

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'secret');
  mocks.reconcile.mockReset().mockResolvedValue({ checked: 0, updated: 0 });
});

describe('GET /api/cron/reconcile', () => {
  it('401 sem bearer', async () => {
    const res = await GET(new Request('http://localhost/api/cron/reconcile'));
    expect(res.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('401 com bearer errado', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/reconcile', {
        headers: { authorization: 'Bearer outro' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('200 com bearer e devolve o resultado', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/reconcile', {
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 0, updated: 0 });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it('500 JSON quando reconcileSubscriptions lança', async () => {
    mocks.reconcile.mockRejectedValueOnce(new Error('db down'));
    const res = await GET(
      new Request('http://localhost/api/cron/reconcile', {
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'reconcile failed' });
  });
});

describe('POST /api/cron/reconcile', () => {
  it('é equivalente ao GET', async () => {
    const res = await POST(
      new Request('http://localhost/api/cron/reconcile', {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it('401 sem bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/reconcile', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});
