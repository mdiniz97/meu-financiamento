import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dunning: vi.fn() }));
vi.mock('@/lib/subscriptions/dunning', () => ({ runDunning: mocks.dunning }));

import { GET, POST } from './route';

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'secret');
  mocks.dunning.mockReset().mockResolvedValue({ reminded: 0, suspended: 0 });
});

describe('GET /api/cron/dunning', () => {
  it('401 sem bearer', async () => {
    const res = await GET(new Request('http://localhost/api/cron/dunning'));
    expect(res.status).toBe(401);
    expect(mocks.dunning).not.toHaveBeenCalled();
  });

  it('401 com bearer errado (auth real, sem mock)', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/dunning', {
        headers: { authorization: 'Bearer outro' },
      })
    );
    expect(res.status).toBe(401);
    expect(mocks.dunning).not.toHaveBeenCalled();
  });

  it('200 com bearer e devolve o resultado', async () => {
    const res = await GET(
      new Request('http://localhost/api/cron/dunning', {
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminded: 0, suspended: 0 });
    expect(mocks.dunning).toHaveBeenCalledTimes(1);
  });

  it('500 JSON quando runDunning lança', async () => {
    mocks.dunning.mockRejectedValueOnce(new Error('db down'));
    const res = await GET(
      new Request('http://localhost/api/cron/dunning', {
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'dunning failed' });
  });
});

describe('POST /api/cron/dunning', () => {
  it('é equivalente ao GET', async () => {
    const res = await POST(
      new Request('http://localhost/api/cron/dunning', {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
      })
    );
    expect(res.status).toBe(200);
    expect(mocks.dunning).toHaveBeenCalledTimes(1);
  });

  it('401 sem bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/dunning', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});
