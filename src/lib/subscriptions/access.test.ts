import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/db', () => ({
  db: { query: { subscriptions: { findMany: mocks.findMany } } },
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

beforeEach(() => mocks.findMany.mockReset());

describe('hasActiveAccess', () => {
  it('true para active dentro do período', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 1000),
        graceUntil: null,
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('false para incomplete', async () => {
    mocks.findMany.mockResolvedValue([
      { status: 'incomplete', currentPeriodEnd: null, graceUntil: null },
    ]);
    expect(await hasActiveAccess('u1')).toBe(false);
  });
  it('true para past_due dentro da carência', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'past_due',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: new Date(Date.now() + 1000),
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('false para past_due fora da carência', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'past_due',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: new Date(Date.now() - 1),
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(false);
  });
  it('true quando uma linha active vencida convive com uma active válida', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: null,
      },
      {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 1000),
        graceUntil: null,
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('true quando uma linha past_due fora da carência convive com uma active válida', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'past_due',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: new Date(Date.now() - 1),
      },
      {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 1000),
        graceUntil: null,
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(true);
  });
  it('false quando todas as linhas estão vencidas/lapsadas', async () => {
    mocks.findMany.mockResolvedValue([
      {
        status: 'active',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: null,
      },
      {
        status: 'past_due',
        currentPeriodEnd: new Date(Date.now() - 1000),
        graceUntil: new Date(Date.now() - 1),
      },
    ]);
    expect(await hasActiveAccess('u1')).toBe(false);
  });
  it('false quando não há linhas', async () => {
    mocks.findMany.mockResolvedValue([]);
    expect(await hasActiveAccess('u1')).toBe(false);
  });
});
