'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';

export interface SavedNegotiation {
  id: string;
  name: string;
  payload: unknown;
  result: unknown;
  createdAt: Date;
}

export async function listNegotiations(): Promise<SavedNegotiation[]> {
  const session = await auth();
  if (!session?.userId) return [];
  const rows = await db.query.simulations.findMany({
    where: and(
      eq(schema.simulations.userId, session.userId),
      eq(schema.simulations.system, 'negociacao')
    ),
  });
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((r) => ({ id: r.id, name: r.name, payload: r.payload, result: r.result, createdAt: r.createdAt }));
}
