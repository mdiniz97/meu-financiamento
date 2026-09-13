import { loadSimulation } from './actions';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { SimulationSandbox } from '@/components/simulation/SimulationSandbox';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function SimulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  const saved = typeof id === 'string' && id ? await loadSimulation(id) : null;
  const session = await auth();
  const { isUnlimited } = session?.userId
    ? await getCreditBalance(session.userId)
    : { isUnlimited: false };

  return (
    <PageShell>
      <PageHeader
        title="Simulação"
        description="Simulador de financiamento PRICE e SAC com amortizações e comparação de cenários."
      />
      <SimulationSandbox saved={saved} isUnlimited={isUnlimited} />
    </PageShell>
  );
}
