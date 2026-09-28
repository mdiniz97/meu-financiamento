import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { assertSameOrigin } from '@/lib/security/same-origin';

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
  } catch {
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || typeof (body as { offersEnabled?: unknown }).offersEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Preferência inválida' }, { status: 400 });
  }
  const offersEnabled = (body as { offersEnabled: boolean }).offersEnabled;
  await db.update(schema.users)
    .set({ activationBonusOptOutAt: offersEnabled ? null : new Date() })
    .where(eq(schema.users.id, session.userId));

  return NextResponse.json({ offersEnabled }, { headers: { 'Cache-Control': 'no-store' } });
}
