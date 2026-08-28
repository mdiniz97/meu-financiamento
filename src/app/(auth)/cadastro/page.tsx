import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { emailLoginEnabled } from '@/lib/auth-mode';
import { CadastroForm } from './cadastro-form';

export default async function CadastroPage() {
  const session = await auth();
  if (session?.userId) redirect('/nova-simulacao');
  if (!emailLoginEnabled()) redirect('/login');
  return <CadastroForm />;
}
