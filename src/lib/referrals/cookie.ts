import { cookies } from 'next/headers';

export const REFERRAL_COOKIE = 'referral_code';
export const REFERRAL_COOKIE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const isReferralCode = (code: string): boolean => /^[A-Za-z0-9_-]{22}$/.test(code);

export async function readReferralCode(): Promise<string | null> {
  const value = (await cookies()).get(REFERRAL_COOKIE)?.value;
  return value && isReferralCode(value) ? value : null;
}
