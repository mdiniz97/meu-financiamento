import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loginHref } from '@/lib/login-redirect';
import { getOrCreateReferralCode } from '@/lib/referrals/identity';
import { listReferralsForInviter } from '@/lib/referrals/list';
import { CopyLink } from '@/components/referrals/copy-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Indique amigos' };

export default async function IndiqueAmigosPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/indique-amigos'));
  const [code, referrals] = await Promise.all([
    getOrCreateReferralCode(session.userId),
    listReferralsForInviter(session.userId),
  ]);
  const origin = new URL(process.env.APP_URL ?? (
    process.env.NODE_ENV === 'production' ? 'https://amortiza.me' : 'http://localhost:3000'
  )).origin;
  const available = 5 - referrals.length;

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="font-display text-xl font-semibold">Indique amigos</h1>
          <p className="mt-2 text-muted-foreground">Seu amigo recebe 10 créditos ao criar conta. Depois da primeira simulação salva, vocês dois recebem +5 créditos cada.</p>
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Seu link de indicação</CardTitle>
            <CardDescription>{available === 0 ? 'Suas 5 vagas foram reservadas.' : `${available} ${available === 1 ? 'vaga disponível' : 'vagas disponíveis'} de 5`}</CardDescription>
          </CardHeader>
          <CardContent><CopyLink code={code} origin={origin} disabled={available === 0} /></CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Amigos indicados</CardTitle>
            <CardDescription>Vagas reservadas no cadastro. Crédito extra liberado após primeira simulação salva.</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length ? (
              <ul className="space-y-3">
                {referrals.map(referral => (
                  <li key={`${referral.maskedEmail}-${referral.createdAt.toISOString()}`} className="flex flex-col gap-1 border-b border-border pb-3 text-sm last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <span>{referral.maskedEmail} · {referral.createdAt.toLocaleDateString('pt-BR')}</span>
                    <span className={referral.state === 'awarded' ? 'font-medium text-primary' : 'text-muted-foreground'}>
                      {referral.state === 'awarded' ? '+5 créditos recebidos' : 'Aguardando primeira simulação'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Compartilhe seu link para começar.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
