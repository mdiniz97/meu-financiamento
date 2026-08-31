import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { CadastroForm } from './cadastro-form';

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === 'string' && callbackUrl.startsWith('/') ? callbackUrl : null;
  const session = await auth();
  if (session?.userId) redirect(target ?? '/nova-simulacao');
  if (!emailLoginEnabled()) redirect('/login');
  return <CadastroForm callbackUrl={target} />;
}
