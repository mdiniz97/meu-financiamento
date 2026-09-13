import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { Dashboard } from '@/components/meu-financiamento/dashboard';
import { OnboardingWizard } from '@/components/meu-financiamento/onboarding-wizard';
import { getPageData, recomputeState } from '@/lib/meu-financiamento/repo';
import type { PageState } from '@/lib/meu-financiamento/repo';
import { getSelicAnnual } from '@/lib/market/bacen';
import { PageHeader, PageShell } from '@/components/page-shell';

export const dynamic = 'force-dynamic';

export default async function MeuFinanciamentoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  let state: PageState | null = null;
  let draft: unknown = null;
  try {
    const data = await getPageData(session.userId);
    if (data.contract) {
      state = await recomputeState(session.userId);
    } else {
      draft = data.draft;
    }
  } catch {
    // Estado inconsistente não pode derrubar a página; o wizard recomeça.
  }

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

  return (
    <PageShell>
      <PageHeader
        icon={<Landmark className="size-5 text-[#820AD1]" />}
        title="Meu financiamento"
        badge={
          state?.isUnlimited ? (
            <Badge variant="secondary" className="ml-1">
              Plano Ilimitado
            </Badge>
          ) : undefined
        }
        description="Registre seu contrato para acompanhar saldo, parcelas e amortizações com projeção atualizada."
      />
      {state ? (
        // Expiração do plano (spec): usuário sem Ilimitado com contrato vê
        // a leitura congelada — dados renderizados, ações substituídas por
        // ExclusiveCard dentro do Dashboard. Leitura nunca redireciona nem
        // lança: as actions já exigem Ilimitado no servidor.
        <Dashboard state={state} readOnly={!state.isUnlimited} selicAnnual={selicAnnual} />
      ) : (
        <OnboardingWizard draft={draft} />
      )}
    </PageShell>
  );
}
