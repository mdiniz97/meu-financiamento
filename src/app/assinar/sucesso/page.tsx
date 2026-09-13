import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasActiveAccess } from '@/lib/subscriptions/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SuccessPoller } from './success-poller';

export const metadata: Metadata = {
  title: 'Confirmando assinatura',
  robots: { index: false, follow: false },
};

export default async function AssinarSucessoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinar/sucesso');

  if (await hasActiveAccess(session.userId)) redirect('/perfil');

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Estamos confirmando seu pagamento…</CardTitle>
            <CardDescription>
              Assim que a confirmação chegar, seu acesso Ilimitado é liberado automaticamente.
              Você pode fechar esta página e voltar depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href="/perfil" className="text-primary underline-offset-4 hover:underline">
              Ir para o meu perfil
            </Link>
          </CardContent>
        </Card>
      </div>
      <SuccessPoller />
    </div>
  );
}
