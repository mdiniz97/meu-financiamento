import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Target } from 'lucide-react';
import { MetaCalculator } from '@/components/simulation/MetaCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';

export default async function MetaDeQuitacaoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">

        {isUnlimited ? (
          <MetaCalculator />
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Target className="size-5 text-[#820AD1]" /> Meta de quitação
              </CardTitle>
              <CardDescription>Quer quitar em X anos? Descubra quanto aportar por mês e quanto de juros economiza.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Descubra quanto aportar por mês para quitar antes e quanto de juros você economiza." />
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
