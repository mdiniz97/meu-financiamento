import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ZapIcon } from 'lucide-react';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { getPaymentProvider } from '@/lib/payments';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { startSubscription } from './actions';

export const metadata: Metadata = {
  title: 'Assinar Ilimitado',
  robots: { index: false, follow: false },
};

export default async function AssinarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinar');

  const { isUnlimited } = await getCreditBalance(session.userId);
  if (isUnlimited) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');

  // Modo fake (e testes E2E): auto-aprova e cai em /perfil, como antes.
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake') {
    const { checkoutUrl } = await getPaymentProvider().createCheckout({
      userId: session.userId,
      packId: 'unlimited',
      priceCents: pack.priceCents,
    });
    const sep = checkoutUrl.includes('?') ? '&' : '?';
    redirect(`${checkoutUrl}${sep}userId=${session.userId}&packId=unlimited`);
  }

  // Modo Asaas: ação explícita cria/reusa a assinatura e vai ao checkout hospedado.
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ZapIcon className="size-4" /> Plano Ilimitado
            </CardTitle>
            <CardDescription>
              Simulações ilimitadas, raio X, PDF, amortizador inteligente e portabilidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <span className="text-lg font-semibold">
              {formatBRL(pack.priceCents / 100)}/ano
            </span>
            <p className="text-muted-foreground">
              Você será direcionado ao checkout seguro do Asaas para informar os dados do
              cartão. A assinatura renova automaticamente a cada ano.
            </p>
            <form action={startSubscription}>
              <Button type="submit" className="w-full">
                Assinar Ilimitado
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
