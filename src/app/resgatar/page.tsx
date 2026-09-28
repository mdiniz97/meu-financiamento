import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { ActivationRedeemButton } from '@/components/activation-redeem-button';
import { loginHref } from '@/lib/login-redirect';

export const metadata: Metadata = { title: 'Resgatar créditos', robots: { index: false, follow: false } };

export default async function ResgatarPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/resgatar'));

  const offer = await db.query.activationBonusOffers.findFirst({
    where: eq(schema.activationBonusOffers.userId, session.userId),
  });
  const hasLink = Boolean((await cookies()).get('activation_bonus_token'));

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">Resgatar 2 créditos</h1>
      {offer?.redeemedAt ? (
        <p>Você já resgatou seus 2 créditos de ativação.</p>
      ) : hasLink ? (
        <>
          <p>Confirme o resgate para adicionar 2 créditos à sua conta.</p>
          <ActivationRedeemButton />
        </>
      ) : (
        <p>Abra o link do e-mail de ativação para resgatar seus créditos. Se o prazo do navegador expirou, abra o mesmo link novamente.</p>
      )}
    </main>
  );
}
