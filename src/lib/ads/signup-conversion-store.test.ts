import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { update: mocks.update },
  schema: { users: {
    id: 'id',
    adsSignupConversionId: 'conversionId',
    adsSignupClaimToken: 'claimToken',
    adsSignupClaimUntil: 'claimUntil',
    adsSignupSentAt: 'sentAt',
  } },
}));
vi.mock('drizzle-orm', () => ({
  and: (...items: unknown[]) => ({ op: 'and', items }),
  or: (...items: unknown[]) => ({ op: 'or', items }),
  eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
  isNull: (column: unknown) => ({ op: 'isNull', column }),
  isNotNull: (column: unknown) => ({ op: 'isNotNull', column }),
  lt: (column: unknown, value: unknown) => ({ op: 'lt', column, value }),
  gt: (column: unknown, value: unknown) => ({ op: 'gt', column, value }),
}));

import { claimSignupConversion, ackSignupConversion } from './signup-conversion-store';

beforeEach(() => {
  mocks.returning.mockReset().mockResolvedValue([]);
  mocks.where.mockReset().mockReturnValue({ returning: mocks.returning });
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
});

describe('signup conversion reservation', () => {
  it('returns stable transaction id and temporary claim token for eligible user', async () => {
    mocks.returning.mockImplementation(async () => [{
      transactionId: 'TID_42',
      claimToken: mocks.set.mock.calls[0][0].adsSignupClaimToken,
    }]);

    const result = await claimSignupConversion('user-1', new Date('2026-09-25T12:00:00Z'));

    expect(result).toEqual({ transactionId: 'TID_42', claimToken: expect.stringMatching(/^[a-f\d-]{36}$/i) });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set.mock.calls[0][0].adsSignupClaimUntil).toEqual(new Date('2026-09-25T12:05:00Z'));
    expect(mocks.where.mock.calls[0][0]).toMatchObject({
      op: 'and', items: expect.arrayContaining([{ op: 'eq', column: 'id', value: 'user-1' }]),
    });
  });

  it('returns no claim for existing lease or old account', async () => {
    expect(await claimSignupConversion('user-1')).toBeNull();
  });

  it('returns a new token with same transaction id when expired lease is claimed again', async () => {
    mocks.returning.mockImplementation(async () => [{
      transactionId: 'TID_42',
      claimToken: mocks.set.mock.calls.at(-1)?.[0].adsSignupClaimToken,
    }]);
    const first = await claimSignupConversion('user-1', new Date('2026-09-25T12:00:00Z'));
    const second = await claimSignupConversion('user-1', new Date('2026-09-25T12:06:00Z'));
    expect(second?.transactionId).toBe(first?.transactionId);
    expect(second?.claimToken).not.toBe(first?.claimToken);
  });

  it('acknowledges only a matching user claim returned by the database', async () => {
    mocks.returning.mockResolvedValueOnce([{ id: 'user-1' }]).mockResolvedValueOnce([]);
    const token = '611a98f0-bb03-447e-a0e5-e55492c60c4f';
    expect(await ackSignupConversion('user-1', token, new Date('2026-09-25T12:00:00Z'))).toBe(true);
    expect(await ackSignupConversion('another-user', token, new Date('2026-09-25T12:00:00Z'))).toBe(false);
    expect(mocks.where.mock.calls[1][0].items).toContainEqual({ op: 'eq', column: 'id', value: 'another-user' });
    expect(mocks.where.mock.calls[1][0].items).toContainEqual({ op: 'eq', column: 'claimToken', value: token });
  });
});
