import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { assertSameOrigin } from '@/lib/security/same-origin';

function analyticsConfig() {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  return {
    token: process.env.POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '',
    host: /^https:\/\/(us|eu)\.i\.posthog\.com$/.test(host) ? host : '',
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ userId: null, consent: null, analytics: analyticsConfig() }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { analyticsConsent: true },
  });
  return NextResponse.json(
    { userId: session.userId, consent: user?.analyticsConsent ?? null, analytics: analyticsConfig() },
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
  await db.update(schema.users).set({ analyticsConsent: consent }).where(eq(schema.users.id, session.userId));
  return NextResponse.json({ userId: session.userId, consent }, { headers: { 'Cache-Control': 'no-store' } });
}
