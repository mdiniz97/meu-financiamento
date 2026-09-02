import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { getSelicAnnual } from '@/lib/market/bacen';
import { AlugarComprarCalculator } from '@/components/simulation/AlugarComprarCalculator';

export default async function AlugarOuComprarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Alugar ou comprar?</h1>
        <p className="text-sm text-muted-foreground">
          Compare o patrimônio de comprar um imóvel com o de continuar alugando e investindo.
        </p>
      </div>
      <AlugarComprarCalculator isUnlimited={isUnlimited} selicAnnual={selicAnnual} />
    </div>
  );
}
