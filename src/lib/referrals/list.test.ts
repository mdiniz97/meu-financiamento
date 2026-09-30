import { afterAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db, pool, schema } from '@/db';
import { listReferralsForInviter } from './list';

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';

describe.skipIf(!isolated)('private invitation history (isolated PostgreSQL)', () => {
  const ids: string[] = [];
  afterAll(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids));
    await pool.end();
  });

  it('returns only caller rows, masking invited addresses before serializing', async () => {
    const [inviter, other, invitee, shortEmail] = await db.insert(schema.users).values([
      { name: 'Ana', email: `ana-${crypto.randomUUID()}@example.test`, passwordHash: 'hash' },
      { name: 'Outra', email: `outra-${crypto.randomUUID()}@example.test`, passwordHash: 'hash' },
      { name: 'Fulana', email: 'fulana.silva@example.com', passwordHash: 'hash' },
      { name: 'Curta', email: 'a@b.co', passwordHash: 'hash' },
    ]).returning();
    ids.push(inviter.id, other.id, invitee.id, shortEmail.id);
    await db.insert(schema.referrals).values([
      { inviterId: inviter.id, inviteeId: invitee.id },
      { inviterId: other.id, inviteeId: shortEmail.id },
    ]);
    const rows = await listReferralsForInviter(inviter.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      maskedEmail: 'fu***.sil**@***.com', state: 'pending', createdAt: expect.any(Date),
    });
    expect(JSON.stringify(rows)).not.toContain('fulana.silva@example.com');
    expect(JSON.stringify(rows)).not.toContain('a@b.co');
    expect((await listReferralsForInviter(other.id))[0].maskedEmail).toBe('*@***.co');
  });
});
