import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Landmark } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ConsorcioValeAPenaTabs } from '@/components/simulation/ConsorcioValeAPenaTabs';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function ConsorcioValeAPenaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <PageShell>
      <PageHeader
        icon={<Landmark className="size-5 text-[#820AD1]" />}
        title="Consórcio vale a pena?"
        description="Compare o consórcio com o financiamento ou com investir a parcela todo mês."
      />

      {isUnlimited ? (
        <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <ConsorcioValeAPenaTabs selicAnnual={selicAnnual} />
        </div>
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Compare o consórcio com o financiamento ou com investir a parcela todo mês." />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
