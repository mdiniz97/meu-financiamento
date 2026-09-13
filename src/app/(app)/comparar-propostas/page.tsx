import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';
import { ComparatorClient } from './comparator-client';
import { loadComparison } from './actions';

export default async function CompararPropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const saved = isUnlimited && typeof id === 'string' && id ? await loadComparison(id) : null;

  const name = 'Comparar propostas';
  const desc =
    'Compare até 3 propostas bancárias, audite o CET e descubra quanto o amortizador inteligente pode economizar.';

  return (
    <PageShell>
      <PageHeader
        icon={<Scale className="size-5 text-[#820AD1]" />}
        title={name}
        description={desc}
      />
      {isUnlimited ? (
        <ComparatorClient saved={saved} />
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Compare até 3 propostas lado a lado, audite o CET e aplique o amortizador inteligente."
              />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
