import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { AffordabilityCalculator } from '@/components/simulation/AffordabilityCalculator';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function QualImovelPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  const name = 'Qual imóvel cabe no meu bolso?';
  const desc = 'Descubra o valor máximo do imóvel sem comprometer demais sua renda.';

  return (
    <PageShell>
      <PageHeader
        icon={<Home className="size-5 text-[#820AD1]" />}
        title={name}
        description={desc}
      />
      {isUnlimited ? (
        <AffordabilityCalculator />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Descubra o valor máximo do imóvel sem comprometer demais sua renda."
              />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
