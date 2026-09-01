import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { getSelicAnnual } from '@/lib/market/bacen';
import { ObraCalculator } from '@/components/simulation/ObraCalculator';

export default async function ComprarNaPlantaPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  const selicAnnual = await getSelicAnnual();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Comprar na planta</h1>
        <p className="text-sm text-muted-foreground">
          Entenda o que você paga enquanto a obra não é entregue: juros de obra, seguro e a
          primeira parcela depois da entrega.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: 'Juros de obra',
            text: 'Enquanto a obra é construída, você paga apenas os juros sobre o valor que o banco já liberou, sem amortizar o saldo.',
          },
          {
            title: 'Seguro de obra',
            text: 'Cobertura obrigatória durante a construção (risco da obra), cobrada todo mês junto com os juros.',
          },
          {
            title: 'Entrega da obra',
            text: 'Após a entrega, o saldo começa a ser amortizado e a parcela vira a cheia (juros + amortização).',
          },
        ].map((item) => (
          <div key={item.title} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <span className="text-sm font-semibold">{item.title}</span>
            <span className="text-sm text-muted-foreground">{item.text}</span>
          </div>
        ))}
      </div>

      <ObraCalculator isUnlimited={isUnlimited} selicAnnual={selicAnnual} />
    </div>
  );
}
