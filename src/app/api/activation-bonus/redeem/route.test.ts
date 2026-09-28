import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redeem: vi.fn(), headers: vi.fn(), cookies: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/activation-bonus/redeem', () => ({ redeemActivationBonus: mocks.redeem }));
vi.mock('next/headers', () => ({ headers: mocks.headers, cookies: mocks.cookies }));
import { POST } from './route';

beforeEach(() => {
  vi.stubEnv('APP_URL', 'https://amortiza.me');
  mocks.auth.mockReset().mockResolvedValue({ userId: 'user-1' });
  mocks.redeem.mockReset().mockResolvedValue('redeemed');
  mocks.headers.mockReset().mockResolvedValue(new Headers({ origin: 'https://amortiza.me', host: 'amortiza.me' }));
  mocks.cookies.mockReset().mockResolvedValue({ get: () => ({ value: 'x'.repeat(43) }) });
});

describe('POST /api/activation-bonus/redeem', () => {
  it('rejeita anônimo e origem cruzada antes de creditar', async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await POST()).status).toBe(401);
    mocks.headers.mockResolvedValueOnce(new Headers({ origin: 'https://other.example', host: 'amortiza.me' }));
    expect((await POST()).status).toBe(403);
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it('não credita sem cookie ou com token de outra conta', async () => {
    mocks.cookies.mockResolvedValueOnce({ get: () => undefined });
    expect((await POST()).status).toBe(400);
    mocks.redeem.mockResolvedValueOnce('invalid');
    const response = await POST();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'invalid' });
  });

  it('limpa cookie HttpOnly depois de resgate, sem devolver token', async () => {
    const response = await POST();
    expect(await response.json()).toEqual({ status: 'redeemed' });
    expect(response.headers.get('set-cookie')).toContain('activation_bonus_token=;');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.redeem).toHaveBeenCalledWith({ userId: 'user-1', token: 'x'.repeat(43), now: expect.any(Date) });
  });
});
