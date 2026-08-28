import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getCreditBalance } from '@/lib/credits';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoutButton } from './logout-button';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  const [user, { credits, isUnlimited }] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, session.userId) }),
    getCreditBalance(session.userId),
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
            <p className="text-sm text-muted-foreground">
              Sem assinatura ativa.{' '}
              <a href="/planos" className="font-medium text-primary">
                Ver planos
              </a>
            </p>
          )}
          <div>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
