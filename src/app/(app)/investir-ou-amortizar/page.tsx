import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { getSelicAnnual } from '@/lib/market/bacen';
import { InvestCalculator } from '@/components/simulation/InvestCalculator';

export default async function InvestirOuAmortizarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Investir ou amortizar?</h1>
        <p className="text-sm text-muted-foreground">
          Tem dinheiro disponível? Compare investir na Selic atual com amortizar o
          financiamento, e descubra o que rende mais para o seu caso.
        </p>
      </div>
      <InvestCalculator isUnlimited={isUnlimited} selicAnnual={selicAnnual} />
    </div>
  );
}
