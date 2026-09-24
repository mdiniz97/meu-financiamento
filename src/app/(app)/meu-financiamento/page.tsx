import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { Landmark } from 'lucide-react';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dashboard } from '@/components/meu-financiamento/dashboard';
import { OnboardingWizard } from '@/components/meu-financiamento/onboarding-wizard';
import { getCreditBalance } from '@/lib/credits';
import { shouldLockMeuFinanciamento, shouldShowOnboarding } from '@/lib/meu-financiamento/access';
import { getPageData, recomputeState } from '@/lib/meu-financiamento/repo';
import type { PageData, PageState } from '@/lib/meu-financiamento/repo';
import { getSelicAnnual } from '@/lib/market/bacen';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MeuFinanciamentoPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/meu-financiamento'));

  let state: PageState | null = null;
  let draft: unknown = null;
  let data: PageData | null = null;
  try {
    data = await getPageData(session.userId);
    if (data.contract) {
      state = await recomputeState(session.userId);
    } else {
      draft = data.draft;
    }
  } catch {
    // Estado inconsistente não pode derrubar a página; renderiza estado seguro.
  }

  let isUnlimited = state?.isUnlimited ?? false;
  let accessKnown = state !== null;
  if (!state) {
    try {
      isUnlimited = (await getCreditBalance(session.userId)).isUnlimited;
      accessKnown = true;
    } catch {
      // Sem saldo/subscription confiável, não libera wizard nem paywall.
    }
  }
  const hasContract = data !== null && data.contract !== null;
  const locked = accessKnown && data !== null && shouldLockMeuFinanciamento({ isUnlimited, hasContract });
  const showOnboarding =
    accessKnown && data !== null && shouldShowOnboarding({ isUnlimited, hasContract, hasState: state !== null });

  // Selic só é necessária com contrato e plano Ilimitado (painel Recomendações);
  // falha de rede do BACEN não pode derrubar a página (fallback 10,5% no painel).
  let selicAnnual: number | null = null;
  if (state?.isUnlimited) {
    try {
      selicAnnual = await getSelicAnnual();
    } catch {
      selicAnnual = null;
    }
  }

  if (locked) {
    return (
      <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
        <div className="flex w-full max-w-5xl flex-col gap-6">
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Landmark className="size-5 text-[#820AD1]" /> Meu financiamento
              </CardTitle>
              <CardDescription>
                Registre seu contrato para acompanhar saldo, parcelas e amortizações com projeção atualizada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Registre seu contrato e acompanhe saldo, parcelas e amortizações com projeção atualizada."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className={cn('flex w-full flex-col gap-6', state ? 'max-w-5xl' : 'max-w-2xl')}>
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold">
            <Landmark className="size-5 text-[#820AD1]" />
            Meu financiamento
            {state?.isUnlimited && (
              <Badge variant="secondary" className="ml-1">
                Plano Ilimitado
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre seu contrato para acompanhar saldo, parcelas e amortizações com projeção atualizada.
          </p>
        </div>
        {state ? (
          // Expiração do plano (spec): usuário sem Ilimitado com contrato vê
          // a leitura congelada — dados renderizados, ações substituídas por
          // ExclusiveCard dentro do Dashboard. Leitura nunca redireciona nem
          // lança: as actions já exigem Ilimitado no servidor.
          <Dashboard state={state} readOnly={!state.isUnlimited} selicAnnual={selicAnnual} />
        ) : showOnboarding ? (
          <OnboardingWizard draft={draft} />
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <h2 className="font-display text-lg font-semibold">Não foi possível carregar seu financiamento</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Atualize a página. Se o problema continuar, entre em contato com o suporte.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
