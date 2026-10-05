import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Handshake } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { NegotiationCalculator } from '@/components/simulation/NegotiationCalculator';

export default async function NegociacaoPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/negociacao'));
  const { isUnlimited } = await getCreditBalance(session.userId);

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {isUnlimited ? (
          <NegotiationCalculator />
        ) : (
          <>
            <UpgradeCard />
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                  <Handshake className="size-5 text-[#820AD1]" /> Mesa de negociação
                </CardTitle>
                <CardDescription>
                  Descubra o teto da taxa, a entrada mínima e o prazo mínimo antes de fechar com o banco.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExclusiveCard
                  isUnlimited={false}
                  benefit="Negocie com números: taxa máxima, entrada mínima e prazo mínimo para a proposta caber no seu orçamento."
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
