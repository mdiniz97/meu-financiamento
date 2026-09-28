import { and, asc, eq, gte, isNull, lt, lte } from 'drizzle-orm';
import { db, schema } from '@/db';
import { sendEmail } from '@/lib/email/client';
import { isEmailEnabled } from '@/lib/email/config';
import { activationBonusEmail, type ActivationVariant } from '@/lib/email/templates';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { createActivationToken } from './token';

const NEW_LIMIT = 20;
const HISTORICAL_LIMIT = 30;
const DAY_MS = 86_400_000;

function campaignConfig(): { start: Date; appUrl: string } | null {
  const raw = process.env.ACTIVATION_BONUS_START_AT;
  if (!raw || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(raw)) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  try {
    const url = new URL(process.env.APP_URL ?? '');
    if ((url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) return null;
    return { start, appUrl: url.origin };
  } catch {
    return null;
  }
}

export async function runActivationBonus(now = new Date()): Promise<{
  eligible: number; attempted: number; skipped: number; failed: number;
}> {
  const result = { eligible: 0, attempted: 0, skipped: 0, failed: 0 };
  const cfg = campaignConfig();
  if (!cfg || !isEmailEnabled()) return result;

  const cutoff = new Date(now.getTime() - DAY_MS);
  async function candidates(historical: boolean, limit: number) {
    return db.select({ id: schema.users.id }).from(schema.users)
      .leftJoin(schema.activationBonusOffers, eq(schema.activationBonusOffers.userId, schema.users.id))
      .where(and(
        lte(schema.users.createdAt, cutoff),
        historical ? lt(schema.users.createdAt, cfg!.start) : gte(schema.users.createdAt, cfg!.start),
        isNull(schema.users.activationBonusOptOutAt),
        isNull(schema.activationBonusOffers.id),
      ))
      .orderBy(asc(schema.users.createdAt), asc(schema.users.id)).limit(limit);
  }
  const selected = [
    ...(await candidates(false, NEW_LIMIT)),
    ...(await candidates(true, HISTORICAL_LIMIT)),
  ];

  for (const { id } of selected) {
    // Re-read mutable user state just before reserving; unique user_id arbitrates concurrent cron runs.
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    if (!user || user.activationBonusOptOutAt || user.createdAt > cutoff) continue;
    result.eligible++;
    if (await hasActiveAccess(id)) {
      const [reserved] = await db.insert(schema.activationBonusOffers).values({
        userId: id, state: 'skipped_unlimited',
      }).onConflictDoNothing({ target: schema.activationBonusOffers.userId })
        .returning({ id: schema.activationBonusOffers.id });
      if (reserved) result.skipped++;
      continue;
    }

    const saved = await db.query.simulations.findFirst({ where: eq(schema.simulations.userId, id) });
    const variant: ActivationVariant = saved ? 'keep_exploring' : 'first_simulation';
    const { token, hash } = createActivationToken();
    const [reserved] = await db.insert(schema.activationBonusOffers).values({
      userId: id, state: 'attempted', variant, tokenHash: hash, emailAttemptedAt: now,
    }).onConflictDoNothing({ target: schema.activationBonusOffers.userId })
      .returning({ id: schema.activationBonusOffers.id });
    if (!reserved) continue;

    result.attempted++;
    try {
      await sendEmail({
        to: user.email,
        ...activationBonusEmail({
          name: user.name, variant,
          redeemUrl: `${cfg.appUrl}/resgatar/link?t=${token}`,
          preferencesUrl: `${cfg.appUrl}/perfil`,
        }),
      });
    } catch {
      // Any uncertain provider outcome remains attempted: no automatic retry.
      result.failed++;
    }
  }
  return result;
}
