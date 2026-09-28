import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { hashActivationToken } from './token';

export async function redeemActivationBonus(input: {
  userId: string; token: string; now: Date;
}): Promise<'redeemed' | 'already_redeemed' | 'invalid'> {
  const tokenHash = hashActivationToken(input.token);
  if (!tokenHash) return 'invalid';

  return db.transaction(async (tx) => {
    const [winner] = await tx.update(schema.activationBonusOffers)
      .set({ redeemedAt: input.now })
      .where(and(
        eq(schema.activationBonusOffers.tokenHash, tokenHash),
        eq(schema.activationBonusOffers.userId, input.userId),
        eq(schema.activationBonusOffers.state, 'attempted'),
        isNull(schema.activationBonusOffers.redeemedAt),
      ))
      .returning({ id: schema.activationBonusOffers.id });

    if (winner) {
      await tx.insert(schema.creditLedger).values({
        userId: input.userId, amount: 2, kind: 'bonus', description: `activation:${winner.id}`,
      });
      return 'redeemed';
    }

    const [previous] = await tx.select({ redeemedAt: schema.activationBonusOffers.redeemedAt })
      .from(schema.activationBonusOffers)
      .where(and(
        eq(schema.activationBonusOffers.tokenHash, tokenHash),
        eq(schema.activationBonusOffers.userId, input.userId),
        eq(schema.activationBonusOffers.state, 'attempted'),
      )).limit(1);
    return previous?.redeemedAt ? 'already_redeemed' : 'invalid';
  });
}
