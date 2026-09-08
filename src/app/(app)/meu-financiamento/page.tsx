import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { auth } from '@/auth';
import { OnboardingWizard } from '@/components/meu-financiamento/onboarding-wizard';
import { Card, CardContent } from '@/components/ui/card';
import { getPageData } from '@/lib/meu-financiamento/repo';
import { formatBRL } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatDataBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default async function MeuFinanciamentoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  let contract = null;
  let draft: unknown = null;
  try {
    const data = await getPageData(session.userId);
    contract = data.contract;
    draft = data.draft;
  } catch {
    // Estado inconsistente não pode derrubar a página; o wizard recomeça.
  }

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Landmark className="size-5 text-[#820AD1]" />
            Meu financiamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre seu contrato para acompanhar saldo, parcelas e amortizações com projeção atualizada.
          </p>
        </div>
        {contract ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex flex-col items-start gap-2 pt-6">
              <h2 className="font-display text-lg font-semibold">Seu financiamento está cadastrado</h2>
              <p className="text-sm text-muted-foreground">
                {contract.params.bank} em {contract.params.system}, saldo devedor de{' '}
                {formatBRL(contract.baseline.saldoDevedor)} na data-base de {formatDataBr(contract.baseline.dataBase)}.
              </p>
              <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                O painel com parcelas, amortizações e recalibrações entra em uma próxima etapa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <OnboardingWizard draft={draft} />
        )}
      </div>
    </div>
  );
}
