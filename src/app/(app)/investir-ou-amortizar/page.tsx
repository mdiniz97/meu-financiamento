import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { TrendingUp } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { InvestCalculator } from '@/components/simulation/InvestCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';

export default async function InvestirOuAmortizarPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/investir-ou-amortizar'));
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">

        {isUnlimited ? (
          <InvestCalculator selicAnnual={selicAnnual} />
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <TrendingUp className="size-5 text-[#820AD1]" /> Investir ou amortizar?
              </CardTitle>
              <CardDescription>Tem dinheiro disponível? Compare investir na Selic atual com amortizar o financiamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Descubra se vale mais investir seu dinheiro ou amortizar o financiamento." />
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
