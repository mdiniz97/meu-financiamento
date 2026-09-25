import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { assertSameOrigin } from '@/lib/security/same-origin';
import { ackSignupConversion } from '@/lib/ads/signup-conversion-store';

const headers = { 'Cache-Control': 'no-store' };
const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
  } catch {
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403, headers });
  }

  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400, headers });
  }
  const claimToken = body && typeof body === 'object' && 'claimToken' in body
    ? (body as { claimToken: unknown }).claimToken
    : null;
  if (typeof claimToken !== 'string' || !uuidPattern.test(claimToken)) {
    return NextResponse.json({ error: 'Reserva inválida' }, { status: 400, headers });
  }

  const acknowledged = await ackSignupConversion(session.userId, claimToken);
  return NextResponse.json({ acknowledged }, { status: acknowledged ? 200 : 409, headers });
}
