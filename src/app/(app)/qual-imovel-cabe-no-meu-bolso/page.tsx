import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Home } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { AffordabilityCalculator } from '@/components/simulation/AffordabilityCalculator';

export default async function QualImovelPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  const name = 'Qual imóvel cabe no meu bolso?';
  const desc = 'Descubra o valor máximo do imóvel sem comprometer demais sua renda.';

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {isUnlimited ? (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-xl font-semibold">{name}</h1>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            <AffordabilityCalculator />
          </>
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Home className="size-5 text-[#820AD1]" /> {name}
              </CardTitle>
              <CardDescription>{desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard
                isUnlimited={false}
                benefit="Descubra o valor máximo do imóvel sem comprometer demais sua renda."
              />
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  );
}
