import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/activation-bonus/send', () => ({ runActivationBonus: mocks.run }));
import { GET, POST } from './route';

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  mocks.run.mockReset().mockResolvedValue({ eligible: 1, attempted: 1, skipped: 0, failed: 0 });
});

describe('/api/cron/activation-bonus', () => {
  it('rejeita requisição sem bearer antes do envio', async () => {
    const response = await GET(new Request('https://amortiza.me/api/cron/activation-bonus'));
    expect(response.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('retorna somente contagens agregadas a cron autorizado', async () => {
    const response = await POST(new Request('https://amortiza.me/api/cron/activation-bonus', {
      method: 'POST', headers: { authorization: 'Bearer test-cron-secret' },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eligible: 1, attempted: 1, skipped: 0, failed: 0 });
  });

  it('retorna erro genérico quando banco falha', async () => {
    mocks.run.mockRejectedValueOnce(new Error('sensitive database details'));
    const response = await GET(new Request('https://amortiza.me/api/cron/activation-bonus', {
      headers: { authorization: 'Bearer test-cron-secret' },
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'activation bonus failed' });
  });
});
