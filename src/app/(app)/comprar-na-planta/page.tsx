import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Home } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ObraCalculator } from '@/components/simulation/ObraCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';

export default async function ComprarNaPlantaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">

        {isUnlimited ? (
          <>
            <ObraCalculator selicAnnual={selicAnnual} />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Juros de obra', text: 'Enquanto a obra é construída, você paga apenas os juros sobre o valor que o banco já liberou, sem amortizar o saldo.' },
                { title: 'Seguro de obra', text: 'Cobertura obrigatória durante a construção (risco da obra), cobrada todo mês junto com os juros.' },
                { title: 'Entrega da obra', text: 'Após a entrega, o saldo começa a ser amortizado e a parcela vira a cheia (juros + amortização).' },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="text-sm text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                <Home className="size-5 text-[#820AD1]" /> Comprar na planta
              </CardTitle>
              <CardDescription>Entenda o que você paga enquanto a obra não é entregue: juros de obra, seguro e a primeira parcela depois da entrega.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Simule juros de obra, seguro e entrada parcelada até a entrega das chaves." />
            </CardContent>
          </Card>
          </>
        )}

      </div>
    </div>
  );
}
