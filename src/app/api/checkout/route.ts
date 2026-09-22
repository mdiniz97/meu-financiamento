import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getPaymentProvider } from '@/lib/payments';
import { createCreditsCheckout } from '@/lib/payments/asaas/checkout';
import { AsaasApiError } from '@/lib/payments/asaas/client';

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

  // No Asaas créditos avulsos usam checkout DETACHED (cartão + Pix); assinatura
  // é só por /assinar.
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'asaas') {
    if (pack.isSubscription) {
      return NextResponse.json(
        { error: 'Use /assinar para assinar o plano Ilimitado.' },
        { status: 400 }
      );
    }

    // Pack avulso sem créditos: o usuário pagaria e não receberia nada.
    if (!pack.credits || pack.credits <= 0) {
      return NextResponse.json({ error: 'Pack de créditos inválido.' }, { status: 400 });
    }

    const [purchase] = await db
      .insert(schema.creditPurchases)
      .values({
        userId: session.userId,
        packId,
        provider: 'asaas',
        status: 'pending',
        credits: pack.credits ?? 0,
      })
      .returning({ id: schema.creditPurchases.id });

    // APP_URL lido em runtime (não no topo do módulo): evita congelar o valor
    // antigo quando .env.local muda; trim da barra final evita `//perfil`.
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3012').replace(/\/+$/, '');
    let checkout: { id: string; link: string };
    try {
      checkout = await createCreditsCheckout({
        externalReference: purchase.id,
        valueCents: pack.priceCents,
        successUrl: `${appUrl}/perfil`,
        cancelUrl: `${appUrl}/perfil`,
        expiredUrl: `${appUrl}/perfil`,
      });
    } catch (e) {
      // A rejected checkout (400) has no remote resource. Preserve pending
      // for other outcomes, especially timeouts, rate limits and server errors.
      const detail = e instanceof AsaasApiError ? e.message : 'erro inesperado';
      const checkoutRejected = e instanceof AsaasApiError && e.status === 400;
      const pixUnavailable =
        e instanceof AsaasApiError && e.status === 400 && /pix/i.test(JSON.stringify(e.body));
      console.error(`[checkout] falha ao criar checkout de créditos: ${detail}`);
      if (checkoutRejected) {
        try {
          await db
            .update(schema.creditPurchases)
            .set({ status: 'canceled' })
            .where(eq(schema.creditPurchases.id, purchase.id));
        } catch (updateError) {
          console.error('[checkout] falha ao cancelar compra rejeitada', updateError);
        }
      }
      return NextResponse.json(
        {
          error: pixUnavailable
            ? 'Pix está indisponível no momento. Entre em contato com o suporte para concluir sua compra.'
            : 'Não foi possível iniciar a compra agora. Tente de novo em instantes.',
        },
        { status: 502 }
      );
    }

    await db
      .update(schema.creditPurchases)
      .set({ asaasCheckoutId: checkout.id })
      .where(eq(schema.creditPurchases.id, purchase.id));

    return NextResponse.json({ checkoutUrl: checkout.link });
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
