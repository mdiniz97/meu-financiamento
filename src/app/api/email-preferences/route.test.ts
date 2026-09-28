import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), origin: vi.fn(), update: vi.fn(), set: vi.fn(), where: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/security/same-origin', () => ({ assertSameOrigin: mocks.origin }));
vi.mock('@/db', () => ({
  db: { update: mocks.update },
  schema: { users: { id: 'id', activationBonusOptOutAt: 'activationBonusOptOutAt' } },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
import { POST } from './route';

function request(offersEnabled: unknown) {
  return new Request('https://amortiza.me/api/email-preferences', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offersEnabled }),
  });
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ userId: 'test-user' });
  mocks.origin.mockReset().mockResolvedValue(undefined);
  mocks.where.mockReset().mockResolvedValue(undefined);
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
});

describe('POST /api/email-preferences', () => {
  it('bloqueia sem sessão, sem atualizar usuário', async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await POST(request(false))).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('bloqueia origem cruzada, sem atualizar usuário', async () => {
    mocks.origin.mockRejectedValueOnce(new Error('wrong origin'));
    expect((await POST(request(false))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejeita corpo inválido e campo não booleano', async () => {
    expect((await POST(request('no'))).status).toBe(400);
    expect((await POST(new Request('https://amortiza.me/api/email-preferences', {
      method: 'POST', body: '{',
    }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('grava data de recusa e deixa análise independente', async () => {
    const response = await POST(request(false));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.set).toHaveBeenCalledWith({ activationBonusOptOutAt: expect.any(Date) });
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty('analyticsConsent');
  });

  it('reativa ofertas apagando recusa sem afetar mensagens operacionais', async () => {
    expect((await POST(request(true))).status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ activationBonusOptOutAt: null });
  });
});
