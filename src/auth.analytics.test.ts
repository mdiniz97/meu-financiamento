import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  nextAuth: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  insertedValues: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  captureAccountEvent: vi.fn(),
}));
vi.mock('next-auth', () => ({
  default: (config: unknown) => {
    mocks.nextAuth(config);
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
  },
}));
vi.mock('next-auth/providers/google', () => ({ default: () => ({ id: 'google' }) }));
vi.mock('next-auth/providers/credentials', () => ({ default: () => ({ id: 'credentials' }) }));
vi.mock('@/lib/auth-mode', () => ({ emailLoginEnabled: () => false }));
vi.mock('@/lib/email/notify', () => ({ sendWelcomeEmail: mocks.sendWelcomeEmail, WELCOME_BONUS_CREDITS: 2 }));
vi.mock('@/lib/analytics/server', () => ({ captureAccountEvent: mocks.captureAccountEvent }));
vi.mock('@/db', () => ({ db: { query: { users: { findFirst: mocks.findFirst } }, transaction: mocks.transaction }, schema: { users: { email: 'email' }, creditLedger: {} } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), sql: () => 'SQL_EXPRESSION' }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hash') } }));

import './auth';

type SignIn = (input: { user: { id?: string; email?: string | null; name?: string | null }; account: { provider: string } }) => Promise<boolean>;
const signIn = () => (mocks.nextAuth.mock.calls[0][0] as { callbacks: { signIn: SignIn } }).callbacks.signIn;

beforeEach(() => {
  mocks.findFirst.mockReset().mockResolvedValue(null);
  mocks.captureAccountEvent.mockReset().mockResolvedValue(undefined);
  mocks.sendWelcomeEmail.mockReset().mockResolvedValue(true);
  mocks.insertedValues.mockReset().mockImplementation(() => ({ returning: async () => [{ id: 'u1', name: 'User', email: 'user@example.com' }] }));
  mocks.transaction.mockReset().mockImplementation(async (fn) => fn({
    insert: () => ({ values: mocks.insertedValues }),
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe('Google account creation analytics', () => {
  it('records signup after creating an account, without email or name', async () => {
    const user = { email: 'user@example.com', name: 'User' };
    await signIn()({ user, account: { provider: 'google' } });
    expect(mocks.captureAccountEvent).toHaveBeenCalledWith('u1', 'signup_completed', 'u1');
  });

  it('does not count a returning Google login as signup', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'existing' });
    await signIn()({ user: { email: 'user@example.com' }, account: { provider: 'google' } });
    expect(mocks.captureAccountEvent).not.toHaveBeenCalled();
  });

  it('marks only a newly created production Google account for an ads signup', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await signIn()({ user: { email: 'new@example.test' }, account: { provider: 'google' } });
    const insertedUser = mocks.insertedValues.mock.calls[0][0];
    expect(insertedUser.adsSignupConversionId).toBeDefined();
    expect(insertedUser).not.toHaveProperty('adsSignupSentAt');
  });

  it('never marks an existing Google login for conversion', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.findFirst.mockResolvedValue({ id: 'existing' });
    await signIn()({ user: { email: 'existing@example.test' }, account: { provider: 'google' } });
    expect(mocks.insertedValues).not.toHaveBeenCalled();
  });
});
