import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { getCreditBalance } from '@/lib/credits';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { BuyPackButton } from '@/app/(app)/planos/buy-pack-button';
import { LogoutButton } from './logout-button';
import { InvoicesCard } from '@/components/invoices-card';
import { ActivationEmailPreference } from '@/components/activation-email-preference';
import { TrialOfferActions } from '@/components/trial/trial-actions';
import { getTrialState } from '@/lib/trial/state';
import { UnlimitedPrice } from '@/components/unlimited-price';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/perfil'));

  const [user, { credits, isUnlimited }, packs, asaasSubscription, trial] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, session.userId) }),
    getCreditBalance(session.userId),
    db.query.packs.findMany({ orderBy: (packs, { asc }) => [asc(packs.priceCents)] }),
    db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, session.userId),
        eq(schema.subscriptions.packId, 'unlimited'),
        eq(schema.subscriptions.provider, 'asaas'),
        eq(schema.subscriptions.status, 'active')
      ),
    }),
    getTrialState(session.userId),
  ]);

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
      <h1 className="font-display text-xl font-semibold">Meu perfil</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{user?.name ?? 'Usuário'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Saldo de créditos</span>
              <span className="text-lg font-semibold">{credits}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Plano</span>
              <span className="text-lg font-semibold">
                {isUnlimited ? 'Ilimitado' : 'Créditos'}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Membro desde</span>
              <span className="text-lg font-semibold">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                  : '-'}
              </span>
            </div>
          </div>
          <div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>

      {trial.offerAvailable && !trial.isTrialActive && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">7 dias grátis do Ilimitado</CardTitle>
            <CardDescription>Ative nas primeiras 48 horas após criar sua conta. Sem cartão e sem cobrança automática.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Ao ativar, você terá 7 dias completos de acesso Ilimitado; seus créditos ficam guardados.</p>
            <TrialOfferActions />
          </CardContent>
        </Card>
      )}

      {trial.isTrialActive && trial.trialEndsAt && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Teste grátis do Ilimitado</CardTitle>
            <CardDescription>Simulações ilimitadas e recursos exclusivos durante seu trial.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">Trial ativo até {trial.trialEndsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
            <p className="text-muted-foreground">Sem cartão e sem cobrança automática. Você pode assinar agora e os dias restantes do trial são somados ao seu plano.</p>
          </CardContent>
        </Card>
      )}

      {trial.offerWindowExpired && !isUnlimited && (
        <p className="text-sm text-muted-foreground">Oferta do trial encerrada: ativação disponível apenas nas primeiras 48 horas após o cadastro.</p>
      )}

      {trial.blockedByPendingCheckout && !isUnlimited && (
        <p className="text-sm text-muted-foreground">Você tem um checkout do Ilimitado em aberto. Conclua o pagamento ou aguarde a expiração para usar a oferta do trial.</p>
      )}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Comunicações por e-mail</CardTitle>
          <CardDescription>Escolha se deseja receber ofertas, bônus de ativação e mensagens após o teste grátis.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivationEmailPreference initiallyEnabled={!user?.activationBonusOptOutAt} />
        </CardContent>
      </Card>

      {isUnlimited && !trial.isTrialActive ? (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Plano Ilimitado</CardTitle>
            <CardDescription>
              Sua assinatura está ativa: simulações ilimitadas e salvas enquanto você for
              assinante.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <Badge variant="secondary" className="w-fit">
              Assinatura ilimitada ativa
            </Badge>
            {asaasSubscription?.cancelAtPeriodEnd ? (
              <p className="text-muted-foreground">
                Renovação cancelada. Você mantém o acesso até{' '}
                {asaasSubscription.currentPeriodEnd
                  ? new Date(asaasSubscription.currentPeriodEnd).toLocaleDateString('pt-BR', {
                      timeZone: 'UTC',
                    })
                  : 'o fim do período já pago'}
                .
              </p>
            ) : null}
            {asaasSubscription ? (
              <Link
                href="/assinatura"
                className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}
              >
                Gerenciar assinatura
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(!isUnlimited || trial.isTrialActive) && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Planos</CardTitle>
            <CardDescription>Compre créditos avulsos ou assine o Ilimitado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => (
              <div key={pack.id} className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4">
                <span className="font-semibold">{pack.name}</span>
                {pack.isSubscription ? <>
                  {pack.monthlyPriceCents && <div className="flex flex-col gap-3 border-b pb-4">
                    <span className="text-sm font-semibold">Mensal · mesmos recursos</span>
                    <UnlimitedPrice priceCents={pack.monthlyPriceCents} cycle="MONTHLY" />
                    <BuyPackButton packId={pack.id} isSubscription cycle="MONTHLY" label={`Assinar mensal – ${formatBRL(pack.monthlyPriceCents / 100)}/mês`} />
                  </div>}
                  <span className="text-sm font-semibold">Anual · melhor preço</span>
                  <UnlimitedPrice priceCents={pack.priceCents} />
                  <p className="text-xs text-muted-foreground">Equivale a {formatBRL(pack.priceCents / 1200)}/mês, cobrado de uma vez por ano.</p>
                </> : (
                  <span className="text-sm text-muted-foreground">{formatBRL(pack.priceCents / 100)}</span>
                )}
                 <div className="mt-auto pt-2">
                 <BuyPackButton
                  packId={pack.id}
                  isSubscription={pack.isSubscription}
                  label={
                    pack.isSubscription
                      ? `Assinar ${pack.name} – ${formatBRL(pack.priceCents / 100)}/ano`
                      : `Comprar ${pack.name} – ${formatBRL(pack.priceCents / 100)}`
                  }
                 />
                 </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <InvoicesCard userId={session.userId} />
      </div>
    </div>
  );
}
