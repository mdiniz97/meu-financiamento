import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { redeemActivationBonus } from '@/lib/activation-bonus/redeem';
import { hashActivationToken } from '@/lib/activation-bonus/token';
import { assertSameOrigin } from '@/lib/security/same-origin';

export async function POST() {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  try {
    await assertSameOrigin();
  } catch {
    return NextResponse.json({ status: 'forbidden' }, { status: 403 });
  }
  const token = (await cookies()).get('activation_bonus_token')?.value;
  if (!token || !hashActivationToken(token)) {
    return NextResponse.json({ status: 'invalid' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const status = await redeemActivationBonus({ userId: session.userId, token, now: new Date() });
  const response = NextResponse.json({ status }, {
    status: status === 'invalid' ? 400 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
  if (status !== 'invalid') {
    response.cookies.set('activation_bonus_token', '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 0,
    });
  }
  return response;
}
