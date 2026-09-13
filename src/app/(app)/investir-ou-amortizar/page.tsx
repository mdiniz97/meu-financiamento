import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { TrendingUp } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { InvestCalculator } from '@/components/simulation/InvestCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function InvestirOuAmortizarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <PageShell>
      <PageHeader
        icon={<TrendingUp className="size-5 text-[#820AD1]" />}
        title="Investir ou amortizar?"
        description="Tem dinheiro disponível? Compare investir na Selic atual com amortizar o financiamento."
      />

      {isUnlimited ? (
        <InvestCalculator selicAnnual={selicAnnual} />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Descubra se vale mais investir seu dinheiro ou amortizar o financiamento." />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
