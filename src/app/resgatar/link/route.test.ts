import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

beforeEach(() => vi.stubEnv('APP_URL', 'https://amortiza.me'));

describe('GET /resgatar/link', () => {
  it('limpa URL sem creditar ao receber token formatado', async () => {
    const response = await GET(new Request(`https://amortiza.me/resgatar/link?t=${'x'.repeat(43)}`));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://amortiza.me/resgatar');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
    expect(cookie).toContain('Max-Age=900');
    expect(cookie).toContain('Path=/');
  });

  it('token inválido não define cookie nem deixa query no redirect', async () => {
    const response = await GET(new Request('https://amortiza.me/resgatar/link?t=bad'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://amortiza.me/resgatar');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('remove cookie de link anterior ao abrir link malformado', async () => {
    const response = await GET(new Request('https://amortiza.me/resgatar/link?t=bad', {
      headers: { cookie: `activation_bonus_token=${'x'.repeat(43)}` },
    }));
    expect(response.headers.get('set-cookie')).toContain('activation_bonus_token=;');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
