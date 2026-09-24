import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { CadastroForm } from './cadastro-form';

export const metadata: Metadata = {
  title: 'Criar conta',
  robots: { index: false, follow: false },
};

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : null;
  const session = await auth();
  if (session?.userId) redirect(target ?? '/nova-simulacao');
  if (!emailLoginEnabled()) redirect(loginHref());
  return <CadastroForm callbackUrl={target} />;
}
