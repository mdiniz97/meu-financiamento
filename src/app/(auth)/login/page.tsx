import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Entrar',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : null;
  const session = await auth();
  if (session?.userId) redirect(target ?? '/nova-simulacao');
  return <LoginForm callbackUrl={target} />;
}
