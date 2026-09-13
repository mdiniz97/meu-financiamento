import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { ArrowLeftRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';
import { PortabilityCalculator } from '@/components/simulation/PortabilityCalculator';

export default async function PortabilidadePage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }

  const name = 'Portabilidade';
  const desc = 'Informe seu financiamento atual e a proposta do novo banco: veja se vale a pena portar.';

  return (
    <PageShell>
      <PageHeader
        icon={<ArrowLeftRight className="size-5 text-[#820AD1]" />}
        title={name}
        description={desc}
      />
      {isUnlimited ? (
        <PortabilityCalculator />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Compare manter o contrato com portar para um novo banco."
              />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
