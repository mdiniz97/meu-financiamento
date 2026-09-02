import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { MetaCalculator } from '@/components/simulation/MetaCalculator';

export default async function MetaDeQuitacaoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Meta de quitação</h1>
        <p className="text-sm text-muted-foreground">
          Quer quitar em X anos? Descubra quanto aportar por mês e quanto de juros economiza.
        </p>
      </div>
      <MetaCalculator isUnlimited={isUnlimited} />
    </div>
  );
}
