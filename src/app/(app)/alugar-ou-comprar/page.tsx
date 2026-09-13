import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { KeyRound } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { AlugarComprarCalculator } from '@/components/simulation/AlugarComprarCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function AlugarOuComprarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <PageShell>
      <PageHeader
        icon={<KeyRound className="size-5 text-[#820AD1]" />}
        title="Alugar ou comprar?"
        description="Compare o patrimônio de comprar um imóvel com o de continuar alugando e investindo."
      />

      {isUnlimited ? (
        <AlugarComprarCalculator selicAnnual={selicAnnual} />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Compare o patrimônio de comprar um imóvel com o de continuar alugando e investindo a diferença." />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
