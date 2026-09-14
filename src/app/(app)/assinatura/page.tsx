import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getOwnSubscription } from '@/lib/subscriptions/account';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { InvoicesCard } from '@/components/invoices-card';
import { ManageButtons } from './manage-buttons';

type Subscription = NonNullable<Awaited<ReturnType<typeof getOwnSubscription>>>;

function formatDate(value: Date | null | undefined): string | null {
  return value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null;
}

function statusLabel(subscription: Subscription, periodEnd: string | null): string {
  if (subscription.status === 'canceled' || subscription.status === 'expired') {
    return 'Cancelada';
  }
  if (subscription.status === 'past_due' || subscription.status === 'incomplete') {
    return 'Pagamento pendente';
  }
  if (subscription.cancelAtPeriodEnd) {
    return periodEnd ? `Cancela em ${periodEnd}` : 'Cancelamento agendado';
  }
  return 'Ativa';
}

export default async function AssinaturaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinatura');
  const userId = session.userId;

  const [subscription, pack] = await Promise.all([
    getOwnSubscription(userId),
    db.query.packs.findFirst({ where: eq(schema.packs.id, 'unlimited') }),
  ]);

  const periodEnd = formatDate(subscription?.currentPeriodEnd);
  const graceUntil = formatDate(subscription?.graceUntil);
  const priceLabel = pack ? formatBRL(pack.priceCents / 100) : formatBRL(119.9);
  const cardLabel = subscription?.cardLast4
    ? `****${subscription.cardLast4}${subscription.cardBrand ? ` · ${subscription.cardBrand}` : ''}`
    : null;

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <h1 className="font-display text-xl font-semibold">Minha assinatura</h1>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Plano Ilimitado</CardTitle>
            <CardDescription>
              Gerencie a renovação da sua assinatura: simulações ilimitadas e salvas enquanto
              você for assinante.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {subscription ? (
              <>
                <Badge variant="secondary" className="w-fit">
                  {statusLabel(subscription, periodEnd)}
                </Badge>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
                    <span className="text-xs text-muted-foreground">Valor</span>
                    <span className="text-lg font-semibold">{priceLabel}/ano</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
                    <span className="text-xs text-muted-foreground">Próxima renovação</span>
                    <span className="text-lg font-semibold">{periodEnd ?? '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
                    <span className="text-xs text-muted-foreground">Cartão</span>
                    <span className="text-lg font-semibold">{cardLabel ?? '-'}</span>
                  </div>
                </div>
                {graceUntil ? (
                  <p className="text-muted-foreground">
                    Acesso em carência até {graceUntil}.
                  </p>
                ) : null}
                <ManageButtons
                  cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                  status={subscription.status}
                />
              </>
            ) : (
              <>
                <Badge variant="secondary" className="w-fit">
                  Sem assinatura
                </Badge>
                <p className="text-muted-foreground">
                  Você ainda não tem uma assinatura do plano Ilimitado.
                </p>
                <Link
                  href="/perfil"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
                >
                  Ver planos
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <InvoicesCard userId={userId} />
      </div>
    </div>
  );
}
