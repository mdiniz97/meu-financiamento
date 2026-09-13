import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Target } from 'lucide-react';
import { MetaCalculator } from '@/components/simulation/MetaCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function MetaDeQuitacaoPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  return (
    <PageShell>
      <PageHeader
        icon={<Target className="size-5 text-[#820AD1]" />}
        title="Meta de quitação"
        description="Quer quitar em X anos? Descubra quanto aportar por mês e quanto de juros economiza."
      />

      {isUnlimited ? (
        <MetaCalculator />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Descubra quanto aportar por mês para quitar antes e quanto de juros você economiza." />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
