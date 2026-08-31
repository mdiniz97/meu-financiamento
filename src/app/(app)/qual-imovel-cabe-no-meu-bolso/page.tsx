import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AffordabilityCalculator } from '@/components/simulation/AffordabilityCalculator';
import { AffordabilityLocked } from './locked';

export default async function QualImovelPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);

  if (!isUnlimited) return <AffordabilityLocked />;

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Qual imóvel cabe no meu bolso?</h1>
        <p className="text-sm text-muted-foreground">
          Descubra o valor máximo do imóvel sem comprometer demais sua renda.
        </p>
      </div>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Renda, entrada e financiamento</CardTitle>
          <CardDescription>
            Compare cenários conservador, recomendado e máximo em PRICE e SAC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AffordabilityCalculator />
        </CardContent>
      </Card>
    </div>
  );
}
