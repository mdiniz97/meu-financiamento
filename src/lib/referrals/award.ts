import { and, eq } from 'drizzle-orm';
import { schema } from '@/db';
import type { ReferralTx } from './types';

export async function awardReferralForSavedSimulation(
  tx: ReferralTx,
  inviteeId: string
): Promise<boolean> {
  const [referral] = await tx.update(schema.referrals)
    .set({ state: 'awarded', awardedAt: new Date() })
    .where(and(eq(schema.referrals.inviteeId, inviteeId), eq(schema.referrals.state, 'pending')))
    .returning();
  if (!referral) return false;

  await tx.insert(schema.creditLedger).values(
    [referral.inviterId, referral.inviteeId].map(userId => ({
      userId,
      amount: 5,
      kind: 'referral',
      description: `referral:${referral.id}`,
    }))
  );
  return true;
}
