import { auth } from '@/auth';
import { Sparkles } from 'lucide-react';
import { SmartCalculatorExperience } from '@/components/simulation/SmartCalculatorExperience';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';
import { getCreditBalance } from '@/lib/credits';

export default async function AmortizadorInteligentePage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const balance = await getCreditBalance(session.userId);
    isUnlimited = balance.isUnlimited;
  }

  return (
    <PageShell>
      <PageHeader
        icon={<Sparkles className="size-5 text-[#820AD1]" />}
        title="Amortizador Inteligente"
        description="Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e estratégia."
      />
      {!isUnlimited && <UpgradeCard />}
      <SmartCalculatorExperience isUnlimited={isUnlimited} showHeader={false} />
    </PageShell>
  );
}
