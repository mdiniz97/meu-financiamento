import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/db', () => ({
  db: { query: { subscriptions: { findFirst: mocks.findFirst } } },
  schema: { subscriptions: { userId: 'userId', status: 'status' } },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  gt: vi.fn(),
  sql: vi.fn(),
}));

import { hasActiveAccess } from './access';

beforeEach(() => mocks.findFirst.mockReset());

describe('hasActiveAccess', () => {
  it('true para active dentro do período', async () => {
    mocks.findFirst.mockResolvedValue({
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 1000),
      graceUntil: null,
    });
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('false para incomplete', async () => {
    mocks.findFirst.mockResolvedValue({
      status: 'incomplete',
      currentPeriodEnd: null,
      graceUntil: null,
    });
    expect(await hasActiveAccess('u1')).toBe(false);
  });
  it('true para past_due dentro da carência', async () => {
    mocks.findFirst.mockResolvedValue({
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() - 1000),
      graceUntil: new Date(Date.now() + 1000),
    });
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('false para past_due fora da carência', async () => {
    mocks.findFirst.mockResolvedValue({
      status: 'past_due',
      currentPeriodEnd: new Date(Date.now() - 1000),
      graceUntil: new Date(Date.now() - 1),
    });
    expect(await hasActiveAccess('u1')).toBe(false);
  });
});
