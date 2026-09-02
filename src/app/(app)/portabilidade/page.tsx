import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { ArrowLeftRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
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
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {isUnlimited ? (
          <PortabilityCalculator />
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <ArrowLeftRight className="size-5 text-[#820AD1]" /> {name}
              </CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Compare manter o contrato com portar para um novo banco."
              />
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  );
}
