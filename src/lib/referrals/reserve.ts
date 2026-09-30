import { eq, sql } from 'drizzle-orm';
import { schema } from '@/db';
import { isReferralCode } from './cookie';
import type { ReferralTx } from './types';

export async function reserveReferralForNewUser(
  tx: ReferralTx,
  input: { inviteeId: string; inviteeEmail: string; code: string | null }
): Promise<boolean> {
  const { code, inviteeId, inviteeEmail } = input;
  if (!code || !isReferralCode(code)) return false;
  const inviter = await tx.query.users.findFirst({ where: eq(schema.users.referralCode, code) });
  if (!inviter || inviter.id === inviteeId || inviter.email.toLowerCase() === inviteeEmail.toLowerCase()) return false;

  await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${inviter.id} FOR UPDATE`);
  const [total] = await tx.select({ count: sql<number>`count(*)::int` })
    .from(schema.referrals).where(eq(schema.referrals.inviterId, inviter.id));
  if (total.count >= 5) return false;
  await tx.insert(schema.referrals).values({ inviterId: inviter.id, inviteeId, state: 'pending' });
  return true;
}
