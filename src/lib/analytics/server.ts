import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/** Best-effort analytics. A failed metrics request must never affect billing or simulations. */
export async function captureAccountEvent(userId: string, event: string, uniqueId: string): Promise<void> {
  const token = process.env.POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host || !/^https:\/\/(us|eu)\.i\.posthog\.com$/.test(host)) return;

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { analyticsConsent: true },
    });
    if (!user || user.analyticsConsent === false) return;

    const response = await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        api_key: token,
        distinct_id: userId,
        event,
        properties: {
          $insert_id: createHash('sha256').update(`${event}:${uniqueId}`).digest('hex'),
        },
      }),
    });
    if (!response.ok) console.warn('[analytics] event capture failed');
  } catch {
    console.warn('[analytics] event capture unavailable');
  }
}
