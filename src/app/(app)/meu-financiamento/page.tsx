import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { Dashboard } from '@/components/meu-financiamento/dashboard';
import { OnboardingWizard } from '@/components/meu-financiamento/onboarding-wizard';
import { getPageData, recomputeState } from '@/lib/meu-financiamento/repo';
import type { PageState } from '@/lib/meu-financiamento/repo';
import { getSelicAnnual } from '@/lib/market/bacen';
import { cn } from '@/lib/utils';

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

  // Selic só é necessária com contrato e plano Ilimitado (painel Recomendações).
  const selicAnnual = state?.isUnlimited ? await getSelicAnnual() : null;

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
          // readOnly=false: dashboard sempre editável nesta etapa; a Task 8
          // liga a visão somente leitura para contratos sem o plano Ilimitado.
          <Dashboard state={state} readOnly={false} selicAnnual={selicAnnual} />
        ) : (
          <OnboardingWizard draft={draft} />
        )}
      </div>
    </div>
  );
}
