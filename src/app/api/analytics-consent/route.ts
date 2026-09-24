import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { assertSameOrigin } from '@/lib/security/same-origin';
import { captureAccountEvent } from '@/lib/analytics/server';

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ userId: null, consent: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { analyticsConsent: true },
  });
  return NextResponse.json(
    { userId: session.userId, consent: user?.analyticsConsent ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

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
  if (!body || typeof body !== 'object' || typeof (body as { consent?: unknown }).consent !== 'boolean') {
    return NextResponse.json({ error: 'Consentimento inválido' }, { status: 400 });
  }
  const consent = (body as { consent: boolean }).consent;
  // Account creation may precede consent (e.g. Google login). Only count a
  // recently created, newly consenting account as a signup after opt-in.
  const user = consent ? await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { analyticsConsent: true, createdAt: true },
  }) : null;
  await db.update(schema.users).set({ analyticsConsent: consent }).where(eq(schema.users.id, session.userId));
  if (consent && user?.analyticsConsent === null && user.createdAt) {
    const age = Date.now() - user.createdAt.getTime();
    if (age >= 0 && age <= 30 * 60 * 1000) {
      await captureAccountEvent(session.userId, 'signup_completed', session.userId);
    }
  }
  return NextResponse.json({ userId: session.userId, consent }, { headers: { 'Cache-Control': 'no-store' } });
}
