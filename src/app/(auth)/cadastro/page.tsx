import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { sanitizeNext, signupHref } from '@/lib/login-redirect';

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
};

/**
 * O cadastro virou modal (mesmo esquema do login). Esta rota continua
 * existindo para não quebrar link direto e bookmark — mas só encaminha.
 */
export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { callbackUrl } = await searchParams;
  const raw = Array.isArray(callbackUrl) ? callbackUrl[0] : callbackUrl;
  const target = sanitizeNext(raw);

  const session = await auth();
  if (session?.userId) redirect(target ?? '/nova-simulacao');

  redirect(signupHref(raw));
}
