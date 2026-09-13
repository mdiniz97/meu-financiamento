import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Landmark } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ConsorcioValeAPenaTabs } from '@/components/simulation/ConsorcioValeAPenaTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';

export default async function ConsorcioValeAPenaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">

        {isUnlimited ? (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-xl font-semibold">Consórcio vale a pena?</h1>
              <p className="text-sm text-muted-foreground">Compare o consórcio com o financiamento ou com investir a parcela todo mês.</p>
            </div>
            <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <ConsorcioValeAPenaTabs selicAnnual={selicAnnual} />
          </div>
          </>
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Landmark className="size-5 text-[#820AD1]" /> Consórcio vale a pena?
              </CardTitle>
              <CardDescription>Compare o consórcio com o financiamento ou com investir a parcela todo mês.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Compare o consórcio com o financiamento ou com investir a parcela todo mês." />
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
