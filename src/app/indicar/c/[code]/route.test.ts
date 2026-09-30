import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ inviter: vi.fn(), count: vi.fn(), ledger: vi.fn() }));
vi.mock('@/db', () => ({
  db: { query: { users: { findFirst: mocks.inviter } }, select: () => ({
    from: () => ({ where: mocks.count }),
  }) },
  schema: { users: { referralCode: 'referral_code' }, referrals: { inviterId: 'inviter_id' } },
}));

import { GET } from './route';

const CODE = 'AbCdEfGhIjKlMnOpQrStUv';
function visit(code = CODE, cookie?: string) {
  return GET(new NextRequest(`http://localhost:3000/indicar/c/${encodeURIComponent(code)}`, {
    headers: cookie ? { cookie: `referral_code=${cookie}` } : {},
  }), {
    params: Promise.resolve({ code }),
  });
}

beforeEach(() => {
  mocks.inviter.mockReset().mockResolvedValue({ id: 'inviter' });
  mocks.count.mockReset().mockResolvedValue([{ count: 0 }]);
});

describe('GET invitation link', () => {
  it('redirects to signup with seven-day HttpOnly attribution but no DB write', async () => {
    const res = await visit();
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?signup=1');
    expect(res.cookies.get('referral_code')?.value).toBe(CODE);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/httponly/i);
    expect(cookie).toMatch(/samesite=lax/i);
    expect(cookie).toMatch(/max-age=604800/i);
    expect(cookie).not.toMatch(/domain=/i);
  });

  it('does not set attribution for invalid, unknown or full invitations', async () => {
    for (const code of ['<script>', 'a'.repeat(300)]) {
      const res = await visit(code);
      expect(res.status).toBe(303);
      expect(res.cookies.get('referral_code')).toBeUndefined();
    }
    mocks.inviter.mockResolvedValue(null);
    expect((await visit()).cookies.get('referral_code')).toBeUndefined();
    mocks.inviter.mockResolvedValue({ id: 'inviter' });
    mocks.count.mockResolvedValue([{ count: 5 }]);
    expect((await visit()).cookies.get('referral_code')).toBeUndefined();
  });

  it('requires HTTPS for referral cookie in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const res = await visit();
      expect(res.headers.get('set-cookie')).toMatch(/secure/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('clears previous attribution when visitor opens exhausted invitation', async () => {
    mocks.count.mockResolvedValue([{ count: 5 }]);
    const res = await visit(CODE, 'PreviousReferralCodeA1');
    expect(res.cookies.get('referral_code')?.value).toBe('');
    expect(res.headers.get('set-cookie')).toMatch(/max-age=0/i);
  });
});
