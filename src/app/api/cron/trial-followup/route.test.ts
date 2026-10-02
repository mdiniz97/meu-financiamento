import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorized: vi.fn(), run: vi.fn() }));
vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCronRequest: mocks.authorized }));
vi.mock('@/lib/trial-followup/send', () => ({ runTrialFollowup: mocks.run }));
import { GET } from './route';
beforeEach(() => { vi.clearAllMocks(); });
it('denies unauthenticated cron without running email worker', async () => {
  mocks.authorized.mockReturnValue(false);
  expect((await GET(new Request('http://localhost/api/cron/trial-followup'))).status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
it('returns no-store report for authorized execution', async () => {
  mocks.authorized.mockReturnValue(true);
  mocks.run.mockResolvedValue({ sent: 1, skipped: 0, failed: 0 });
  const result = await GET(new Request('http://localhost/api/cron/trial-followup'));
  expect(await result.json()).toEqual({ sent: 1, skipped: 0, failed: 0 });
  expect(result.headers.get('Cache-Control')).toBe('no-store');
});
