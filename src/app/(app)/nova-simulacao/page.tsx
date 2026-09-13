import { Calculator } from 'lucide-react';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { NovaSimulacaoClient } from '@/components/simulation/NovaSimulacaoClient';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function NovaSimulacaoPage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }
  return (
    <PageShell>
      <PageHeader
        icon={<Calculator className="size-5 text-[#820AD1]" />}
        title="Nova simulação"
        description="Simule financiamentos PRICE e SAC e encontre o melhor modelo pelo seu orçamento."
      />
      <NovaSimulacaoClient isUnlimited={isUnlimited} />
    </PageShell>
  );
}
