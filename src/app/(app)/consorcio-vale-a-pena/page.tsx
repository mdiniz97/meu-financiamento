import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ConsorcioValeAPenaTabs } from '@/components/simulation/ConsorcioValeAPenaTabs';

export default async function ConsorcioValeAPenaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const [{ isUnlimited }, selicAnnual] = await Promise.all([
    getCreditBalance(session.userId),
    getSelicAnnual(),
  ]);

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Consórcio vale a pena?</h1>
        <p className="text-sm text-muted-foreground">
          Compare o consórcio com o financiamento ou com investir a parcela todo mês.
        </p>
      </div>
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <ConsorcioValeAPenaTabs isUnlimited={isUnlimited} selicAnnual={selicAnnual} />
      </div>
    </div>
  );
}
