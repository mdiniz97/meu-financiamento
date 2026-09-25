import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from '@/db';

export type SignupClaim = { transactionId: string; claimToken: string };

/** One conditional update arbitrates competing tabs without reading a stale state. */
export async function claimSignupConversion(
  userId: string,
  now = new Date()
): Promise<SignupClaim | null> {
  const claimToken = randomUUID();
  const [claimed] = await db
    .update(schema.users)
    .set({
      adsSignupClaimToken: claimToken,
      adsSignupClaimUntil: new Date(now.getTime() + 300_000),
    })
    .where(and(
      eq(schema.users.id, userId),
      isNotNull(schema.users.adsSignupConversionId),
      isNull(schema.users.adsSignupSentAt),
      or(
        isNull(schema.users.adsSignupClaimUntil),
        lt(schema.users.adsSignupClaimUntil, now)
      )
    ))
    .returning({
      transactionId: schema.users.adsSignupConversionId,
      claimToken: schema.users.adsSignupClaimToken,
    });

  return claimed?.transactionId && claimed.claimToken
    ? { transactionId: claimed.transactionId, claimToken: claimed.claimToken }
    : null;
}

/** Only the tab holding the current unexpired lease may finalize the conversion. */
export async function ackSignupConversion(
  userId: string,
  claimToken: string,
  now = new Date()
): Promise<boolean> {
  const rows = await db
    .update(schema.users)
    .set({ adsSignupSentAt: now })
    .where(and(
      eq(schema.users.id, userId),
      eq(schema.users.adsSignupClaimToken, claimToken),
      isNull(schema.users.adsSignupSentAt),
      gt(schema.users.adsSignupClaimUntil, now)
    ))
    .returning({ id: schema.users.id });
  return rows.length === 1;
}
