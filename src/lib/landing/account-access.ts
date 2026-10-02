import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { hasActiveAccess } from '@/lib/subscriptions/access';

export async function canOpenFinancing(userId: string): Promise<boolean> {
  if (await hasActiveAccess(userId)) return true;
  return Boolean(await db.query.contracts.findFirst({
    where: eq(schema.contracts.userId, userId), columns: { id: true },
  }));
}
