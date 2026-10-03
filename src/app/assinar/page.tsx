import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { eq } from 'drizzle-orm';
import { ZapIcon } from 'lucide-react';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import Link from 'next/link';
import { UnlimitedPrice } from '@/components/unlimited-price';
import { requireBillingCycle, subscriptionPrice } from '@/lib/subscriptions/plans';
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

export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ cycle?: string; pending?: string }> }) {
  const query = await searchParams;
  const cycle = requireBillingCycle(query.cycle ?? 'YEARLY');
  const session = await auth();
  if (!session?.userId) redirect(loginHref(`/assinar?cycle=${cycle}`));

  const { isUnlimited } = await getCreditBalance(session.userId);
  if (isUnlimited) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');

  const priceCents = subscriptionPrice(pack, cycle);

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
              Simulações ilimitadas, análise do financiamento, PDF, amortizador inteligente e portabilidade.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <nav className="flex gap-4" aria-label="Período de cobrança">
              {pack.monthlyPriceCents && <Link href="/assinar?cycle=MONTHLY" aria-current={cycle === 'MONTHLY' ? 'page' : undefined} className={cycle === 'MONTHLY' ? 'font-bold text-primary' : 'underline'}>Mensal</Link>}
              <Link href="/assinar?cycle=YEARLY" aria-current={cycle === 'YEARLY' ? 'page' : undefined} className={cycle === 'YEARLY' ? 'font-bold text-primary' : 'underline'}>Anual · melhor preço</Link>
            </nav>
            <UnlimitedPrice priceCents={priceCents} cycle={cycle} />
            {query.pending && <p role="status">Checkout em processamento ou aberto para outro período. Aguarde confirmação antes de iniciar nova contratação. Se persistir, contate suporte.</p>}
            <p className="text-muted-foreground">
              Você será direcionado ao checkout seguro do Asaas para informar os dados do
              cartão. A assinatura renova automaticamente {cycle === 'MONTHLY' ? 'a cada mês' : 'a cada ano'}. Cancele quando quiser; acesso permanece até fim do período pago.
            </p>
            <form action={startSubscription.bind(null, cycle)}>
              <Button type="submit" className="w-full">
                Assinar Ilimitado {cycle === 'MONTHLY' ? 'mensal' : 'anual'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
