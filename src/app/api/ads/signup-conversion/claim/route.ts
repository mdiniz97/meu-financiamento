import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { assertSameOrigin } from '@/lib/security/same-origin';
import { claimSignupConversion } from '@/lib/ads/signup-conversion-store';

const headers = { 'Cache-Control': 'no-store' };

export async function POST() {
  try {
    await assertSameOrigin();
  } catch {
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403, headers });
  }

  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers });
  }

  const claim = await claimSignupConversion(session.userId);
  return claim
    ? NextResponse.json(claim, { headers })
    : new NextResponse(null, { status: 204, headers });
}
