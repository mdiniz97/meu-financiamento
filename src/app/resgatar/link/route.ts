import { NextResponse } from 'next/server';
import { hashActivationToken } from '@/lib/activation-bonus/token';

export async function GET(request: Request) {
  const requestedUrl = new URL(request.url);
  const token = requestedUrl.searchParams.get('t');
  const origin = process.env.NODE_ENV === 'production'
    ? (process.env.APP_URL ?? 'https://amortiza.me')
    : requestedUrl.origin;
  const response = NextResponse.redirect(new URL('/resgatar', origin), 303);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  if (token && hashActivationToken(token)) {
    response.cookies.set('activation_bonus_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 900,
    });
  } else if (request.headers.get('cookie')?.split(';').some((part) => part.trim().startsWith('activation_bonus_token='))) {
    response.cookies.set('activation_bonus_token', '', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 0,
    });
  }
  return response;
}
