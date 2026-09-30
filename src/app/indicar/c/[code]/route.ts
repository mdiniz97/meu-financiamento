import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_TTL_SECONDS } from '@/lib/referrals/cookie';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const response = NextResponse.redirect(new URL('/?signup=1', request.url), 303);
  if (request.cookies.has(REFERRAL_COOKIE)) {
    response.cookies.set(REFERRAL_COOKIE, '', {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 0,
    });
  }
  const { code } = await params;
  if (!isReferralCode(code)) return response;

  const inviter = await db.query.users.findFirst({ where: eq(schema.users.referralCode, code) });
  if (!inviter) return response;
  const [total] = await db.select({ count: sql<number>`count(*)::int` })
    .from(schema.referrals).where(eq(schema.referrals.inviterId, inviter.id));
  if (total.count >= 5) return response;

  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFERRAL_COOKIE_TTL_SECONDS,
  });
  return response;
}
