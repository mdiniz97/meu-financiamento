import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CadastroForm } from './cadastro-form';

export default async function CadastroPage() {
  const session = await auth();
  if (session?.userId) redirect('/nova-simulacao');
  return <CadastroForm />;
}
