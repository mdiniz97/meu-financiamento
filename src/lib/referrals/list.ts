import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { maskReferralEmail } from './identity';

export async function listReferralsForInviter(userId: string): Promise<{
  maskedEmail: string;
  state: 'pending' | 'awarded';
  createdAt: Date;
}[]> {
  const rows = await db.select({
    email: schema.users.email,
    state: schema.referrals.state,
    createdAt: schema.referrals.createdAt,
  }).from(schema.referrals)
    .innerJoin(schema.users, eq(schema.referrals.inviteeId, schema.users.id))
    .where(eq(schema.referrals.inviterId, userId))
    .orderBy(desc(schema.referrals.createdAt))
    .limit(5);

  return rows.map(row => ({
    maskedEmail: maskReferralEmail(row.email),
    state: row.state,
    createdAt: row.createdAt,
  }));
}
