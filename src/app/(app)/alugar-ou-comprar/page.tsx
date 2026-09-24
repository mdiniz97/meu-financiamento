import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { KeyRound } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { AlugarComprarCalculator } from '@/components/simulation/AlugarComprarCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';

export default async function AlugarOuComprarPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/alugar-ou-comprar'));
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">

        {isUnlimited ? (
          <AlugarComprarCalculator selicAnnual={selicAnnual} />
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <KeyRound className="size-5 text-[#820AD1]" /> Alugar ou comprar?
              </CardTitle>
              <CardDescription>Compare o patrimônio de comprar um imóvel com o de continuar alugando e investindo.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Compare o patrimônio de comprar um imóvel com o de continuar alugando e investindo a diferença." />
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
