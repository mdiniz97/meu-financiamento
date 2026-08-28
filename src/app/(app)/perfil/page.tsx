import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getCreditBalance } from '@/lib/credits';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BuyPackButton } from '@/app/(app)/planos/buy-pack-button';
import { LogoutButton } from './logout-button';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  const [user, { credits, isUnlimited }, packs] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, session.userId) }),
    getCreditBalance(session.userId),
    db.query.packs.findMany({ orderBy: (packs, { asc }) => [asc(packs.priceCents)] }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 bg-muted p-6">
      <h1 className="text-xl font-semibold">Meu perfil</h1>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{user?.name ?? 'Usuário'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Saldo de créditos</span>
              <span className="text-lg font-semibold">{credits}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Plano</span>
              <span className="text-lg font-semibold">
                {isUnlimited ? 'Ilimitado' : 'Créditos'}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-4">
              <span className="text-xs text-muted-foreground">Membro desde</span>
              <span className="text-lg font-semibold">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
            </div>
          </div>
          {isUnlimited ? (
            <Badge variant="secondary" className="w-fit">
              Assinatura ilimitada ativa
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit">
              {credits} {credits === 1 ? 'crédito disponível' : 'créditos disponíveis'}
            </Badge>
          )}
          <div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Planos</CardTitle>
          <CardDescription>Compre créditos avulsos ou assine o Ilimitado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack) => (
            <div key={pack.id} className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4">
              <span className="font-semibold">{pack.name}</span>
              <span className="text-sm text-muted-foreground">
                {pack.isSubscription
                  ? `${formatBRL(pack.priceCents / 100)}/mês`
                  : formatBRL(pack.priceCents / 100)}
              </span>
              <BuyPackButton
                packId={pack.id}
                label={
                  pack.isSubscription
                    ? `Assinar ${pack.name} – ${formatBRL(pack.priceCents / 100)}/mês`
                    : `Comprar ${pack.name} – ${formatBRL(pack.priceCents / 100)}`
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
