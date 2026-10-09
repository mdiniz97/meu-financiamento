import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@/lib/trial-reminder/send', () => ({ runTrialReminder: mocks.run }));
import { GET, POST } from './route';
afterEach(() => { vi.unstubAllEnvs(); mocks.run.mockReset(); });

it('does not process accounts without cron authorization', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  const response = await GET(new Request('https://amortiza.me/api/cron/trial-reminder'));
  expect(response.status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
it('returns only delivery counts to authorized scheduler', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  mocks.run.mockResolvedValue({ sent: 1, skipped: 2, failed: 0 });
  const response = await POST(new Request('https://amortiza.me/api/cron/trial-reminder', {
    method: 'POST', headers: { authorization: 'Bearer test-secret' },
  }));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ sent: 1, skipped: 2, failed: 0 });
});
it('does not expose worker errors', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  mocks.run.mockRejectedValue(new Error('private database detail'));
  const response = await POST(new Request('https://amortiza.me/api/cron/trial-reminder', {
    method: 'POST', headers: { authorization: 'Bearer test-secret' },
  }));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('private database detail');
});
