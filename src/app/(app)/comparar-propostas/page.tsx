import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
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
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-7xl flex-col gap-6">
        {isUnlimited ? (
          <ComparatorClient saved={saved} />
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Scale className="size-5 text-[#820AD1]" /> {name}
              </CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Compare até 3 propostas lado a lado, audite o CET e aplique o amortizador inteligente."
              />
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  );
}
