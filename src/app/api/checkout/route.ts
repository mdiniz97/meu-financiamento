import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getPaymentProvider } from '@/lib/payments';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let packId: unknown;
  try {
    ({ packId } = (await req.json()) as { packId?: unknown });
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (typeof packId !== 'string' || !packId) {
    return NextResponse.json({ error: 'packId é obrigatório' }, { status: 400 });
  }

  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, packId),
  });
  if (!pack) {
    return NextResponse.json({ error: 'Pack não encontrado' }, { status: 404 });
  }

  // C2 — no Asaas o checkout de créditos ainda não existe; assinatura é só por
  // /assinar. Guarda antes de chamar o provider (que lançaria).
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'asaas') {
    if (!pack.isSubscription) {
      return NextResponse.json(
        {
          error:
            'Compra de créditos ainda não disponível no Asaas; use um pack de assinatura em /assinar.',
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { error: 'Use /assinar para assinar o plano Ilimitado.' },
      { status: 400 }
    );
  }

  const { checkoutUrl } = await getPaymentProvider().createCheckout({
    userId: session.userId,
    packId,
    priceCents: pack.priceCents,
  });

  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake') {
    const sep = checkoutUrl.includes('?') ? '&' : '?';
    return NextResponse.json({
      checkoutUrl: new URL(
        `${checkoutUrl}${sep}userId=${session.userId}&packId=${packId}`,
        req.url
      ).toString(),
    });
  }

  return NextResponse.json({ checkoutUrl: new URL(checkoutUrl, req.url).toString() });
}
