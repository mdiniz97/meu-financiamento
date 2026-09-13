import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Home } from 'lucide-react';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ObraCalculator } from '@/components/simulation/ObraCalculator';
import { Card, CardContent } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { PageHeader, PageShell } from '@/components/page-shell';

export default async function ComprarNaPlantaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();
  return (
    <PageShell>
      <PageHeader
        icon={<Home className="size-5 text-[#820AD1]" />}
        title="Comprar na planta"
        description="Entenda o que você paga enquanto a obra não é entregue: juros de obra, seguro e a primeira parcela depois da entrega."
      />

      {isUnlimited ? (
        <>
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
          <ObraCalculator selicAnnual={selicAnnual} />
        </>
      ) : (
        <>
          <UpgradeCard />
          <Card className="rounded-2xl shadow-sm">
            <CardContent>
              <ExclusiveCard isUnlimited={false} benefit="Simule juros de obra, seguro e entrada parcelada até a entrega das chaves." />
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
