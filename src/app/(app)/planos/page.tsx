import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BuyPackButton } from './buy-pack-button';

export default async function PlanosPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  const [{ credits, isUnlimited }, packs] = await Promise.all([
    getCreditBalance(session.userId),
    db.query.packs.findMany({ orderBy: (packs, { asc }) => [asc(packs.priceCents)] }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 bg-[#F5F5F5] p-6">
      <div>
        <h1 className="text-xl font-semibold">Planos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saldo de créditos:{' '}
          <span className="font-medium text-foreground">{credits}</span>
          {isUnlimited && (
            <Badge variant="secondary" className="ml-2">
              Assinatura ilimitada ativa
            </Badge>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {packs.map((pack) => (
          <Card key={pack.id} className="flex flex-col gap-3 rounded-2xl bg-white shadow-sm">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">{pack.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {pack.isSubscription
                  ? `${formatBRL(pack.priceCents / 100)}/mês`
                  : formatBRL(pack.priceCents / 100)}
              </p>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-3">
              <BuyPackButton
                packId={pack.id}
                label={
                  pack.isSubscription
                    ? `Assinar ${pack.name} – ${formatBRL(pack.priceCents / 100)}/mês`
                    : `Comprar ${pack.name} – ${formatBRL(pack.priceCents / 100)}`
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
