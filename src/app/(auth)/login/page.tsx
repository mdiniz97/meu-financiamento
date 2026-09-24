import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { loginHref, sanitizeNext } from '@/lib/login-redirect';

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

/**
 * O login virou um modal sobre a home. Esta rota continua existindo para não
 * quebrar link direto, bookmark e redirect de servidor — mas só encaminha.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { callbackUrl } = await searchParams;
  const raw = Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl;
  const target = sanitizeNext(raw);

  const session = await auth();
  if (session?.userId) redirect(target ?? '/nova-simulacao');

  redirect(loginHref(raw));
}
