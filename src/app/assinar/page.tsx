import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { getPaymentProvider } from '@/lib/payments';

export const metadata: Metadata = {
  title: 'Assinar Ilimitado',
  robots: { index: false, follow: false },
};

export default async function AssinarPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login?callbackUrl=/assinar');

  const { isUnlimited } = await getCreditBalance(session.userId);
  if (isUnlimited) redirect('/perfil');

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, 'unlimited'),
  });
  if (!pack) redirect('/perfil');

  const { checkoutUrl } = await getPaymentProvider().createCheckout({
    userId: session.userId,
    packId: 'unlimited',
    priceCents: pack.priceCents,
  });

  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake') {
    const sep = checkoutUrl.includes('?') ? '&' : '?';
    redirect(`${checkoutUrl}${sep}userId=${session.userId}&packId=unlimited`);
  }
  redirect(checkoutUrl);
}
