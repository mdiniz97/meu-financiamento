import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getPaymentProvider } from '@/lib/payments';
import { addCredits } from '@/lib/credits';
import { auth } from '@/auth';
import { hasFakeIdempotencyToken, recordFakeIdempotencyToken } from '@/lib/payments/fake-idempotency';

const SUBSCRIPTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEDGER_KIND = 'purchase';

export async function POST(req: Request) {
  const provider = getPaymentProvider();
  const payload = await req.text();
  const signature = req.headers.get('x-signature');
  const result = await provider.verifyWebhook(payload, signature);
  if (!result) {
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 });
  }
  return processPayment(result);
}

export async function GET(req: Request) {
  const fakeProviderEnabled = (process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake';
  if (process.env.NODE_ENV === 'production' || !fakeProviderEnabled) {
    return NextResponse.json(
      { error: 'A aprovação simulada de pagamento não está disponível neste ambiente.' },
      { status: 405 }
    );
  }
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { error: 'Autenticação obrigatória para aprovar pagamento simulado.' },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const packId = searchParams.get('packId');
  if (!userId || !packId) {
    return NextResponse.json(
      { error: 'userId e packId são obrigatórios' },
      { status: 400 }
    );
  }
  if (session.userId !== userId) {
    return NextResponse.json(
      { error: 'Você não pode aprovar pagamento para outra conta.' },
      { status: 403 }
    );
  }
  const result = await getPaymentProvider().verifyWebhook(
    JSON.stringify({ userId, packId }),
    null
  );
  if (!result) {
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 });
  }
  // O providerId do fake é estável por compra (usuário + pacote): recompra do
  // mesmo pacote cai no mesmo providerId e deve RENOVAR a assinatura, não ser
  // tratada como entrega duplicada (que fica idempotente no fluxo POST real).
  // `idempotencyToken` é opcional e dev-only: deduplica chamadas repetidas do
  // GET fake para testes determinísticos (ver processPayment).
  const response = await processPayment(result, {
    extendOnRepeatedProviderId: true,
    idempotencyToken: searchParams.get('idempotencyToken') ?? undefined,
    fakeCreditsAlwaysGrant: true,
  });
  // No fake, a compra é aprovada em tela cheia: devolve o usuário ao perfil
  // com o saldo/plano já atualizado, em vez de uma página de JSON cru.
  if (response.status === 200) {
    return NextResponse.redirect(new URL('/perfil', req.url));
  }
  return response;
}

function isUniqueViolation(e: unknown): boolean {
  // Drizzle aninha o erro do pg em `cause`; percorre a cadeia até achar o code.
  let err = e as { code?: unknown; cause?: unknown } | null;
  while (err && typeof err.code === 'undefined' && err.cause) {
    err = err.cause as { code?: unknown; cause?: unknown } | null;
  }
  return err?.code === '23505';
}

function idempotent() {
  return NextResponse.json({ ok: true, idempotent: true });
}

function conflictRenewal() {
  return NextResponse.json(
    { ok: false, error: 'Conflito de renovação: outra compra estendeu o período, tente novamente' },
    { status: 409 }
  );
}

// Estende currentPeriodEnd com guarda de concorrência otimista: o UPDATE só
// aplica se o fim atual ainda for o que lemos (WHERE currentPeriodEnd = :old).
// Se outra compra ganhou a corrida, o UPDATE não afeta linhas → re-lê e tenta
// uma vez com o fim fresco; se perder de novo, devolve conflito/retry, nunca
// perde silenciosamente os 30 dias de uma compra paga.
type ExtendOutcome = NextResponse | { updated: true };

async function extendSubscription(
  sub: { id: string; currentPeriodEnd: Date | null },
  opts: { providerId?: string; status?: string; idempotencyToken?: string; tokenKey?: string }
): Promise<ExtendOutcome> {
  const recordToken = () => {
    if (opts.idempotencyToken && opts.tokenKey) {
      recordFakeIdempotencyToken(opts.tokenKey, opts.idempotencyToken);
    }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const oldEnd = sub.currentPeriodEnd;
    const base = Math.max(Date.now(), oldEnd?.getTime() ?? 0);
    const newEnd = new Date(base + SUBSCRIPTION_DAYS * DAY_MS);
    const guard = oldEnd
      ? and(
          eq(schema.subscriptions.id, sub.id),
          eq(schema.subscriptions.currentPeriodEnd, oldEnd)
        )
      : // legado: linha sem fim definido, o CAS vira `id AND fim é nulo`, senão
        // duas renovações em paralelo na mesma linha nula estendem do mesmo
        // "agora" sem se verem e uma perde silenciosamente os 30 dias
        and(
          eq(schema.subscriptions.id, sub.id),
          isNull(schema.subscriptions.currentPeriodEnd)
        );
    const updated = await db
      .update(schema.subscriptions)
      .set({
        providerId: opts.providerId,
        status: opts.status ?? 'active',
        currentPeriodEnd: newEnd,
      })
      .where(guard)
      .returning({ id: schema.subscriptions.id });
    if (updated.length > 0) {
      recordToken();
      return { updated: true };
    }
    if (attempt === 0) {
      // corrida: outro request estendeu primeiro; re-lê o estado fresco
      const fresh = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, sub.id),
      });
      if (!fresh) return conflictRenewal();
      if (opts.providerId && fresh.providerId === opts.providerId) {
        return idempotent();
      }
      sub = fresh;
      continue;
    }
    return conflictRenewal();
  }
  return conflictRenewal();
}

async function processPayment(
  result: { userId: string; packId: string; providerId: string },
  opts: {
    extendOnRepeatedProviderId?: boolean;
    idempotencyToken?: string;
    fakeCreditsAlwaysGrant?: boolean;
  } = {}
) {
  const pack = await db.query.packs.findFirst({
    where: eq(schema.packs.id, result.packId),
  });
  if (!pack) {
    return NextResponse.json({ error: 'Pack não encontrado' }, { status: 404 });
  }

  if (pack.isSubscription) {
    const alreadyProcessed = await db.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.providerId, result.providerId),
    });
    if (alreadyProcessed) {
      if (opts.extendOnRepeatedProviderId) {
        // providerId estável do fake: recompra estende o período a partir do
        // maior entre agora e o fim atual (entrega duplicada do mesmo evento
        // não encolhe nem pula o período; compras sequenciais acumulam dias).
        // Aceitação dev-only: repetir o GET fake estende a cada chamada; em
        // produção (POST), providerId repetido é idempotente. Um token de
        // idempotência opcional (`?idempotencyToken=`) deduplica chamadas
        // repetidas do GET fake para testes determinísticos.
        if (
          opts.idempotencyToken &&
          hasFakeIdempotencyToken(`${result.userId}:${result.packId}:${opts.idempotencyToken}`, opts.idempotencyToken)
        ) {
          return idempotent();
        }
        const outcome = await extendSubscription(alreadyProcessed, {
          idempotencyToken: opts.idempotencyToken,
          tokenKey: `${result.userId}:${result.packId}:${opts.idempotencyToken}`,
        });
        if (!('updated' in outcome)) return outcome;
        return NextResponse.json({ ok: true, extended: true });
      }
      return idempotent();
    }
    const providerName = process.env.PAYMENT_PROVIDER ?? 'fake';
    const current = await db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, result.userId),
        eq(schema.subscriptions.packId, result.packId),
        eq(schema.subscriptions.provider, providerName)
      ),
    });
    // renovação real: estende a partir do maior entre agora e o fim atual, sem
    // encolher um período já pago, com guarda de corrida (CAS + re-leitura)
    const currentEnd = current?.currentPeriodEnd?.getTime() ?? 0;
    if (current) {
      const outcome = await extendSubscription(current, {
        providerId: result.providerId,
      });
      if (!('updated' in outcome)) return outcome;
      return NextResponse.json({ ok: true });
    }
    const periodEnd = new Date(
      Math.max(Date.now(), currentEnd) + SUBSCRIPTION_DAYS * DAY_MS
    );
    try {
      await db.insert(schema.subscriptions).values({
        userId: result.userId,
        packId: result.packId,
        provider: providerName,
        providerId: result.providerId,
        status: 'active',
        currentPeriodEnd: periodEnd,
      });
      if (opts.idempotencyToken) {
        recordFakeIdempotencyToken(
          `${result.userId}:${result.packId}:${opts.idempotencyToken}`,
          opts.idempotencyToken
        );
      }
    } catch (e) {
      // Corrida de primeira compra: outro webhook já inseriu a assinatura
      // deste (usuário, pacote, provedor), possível com providerIds DISTINTOS
      // (duas compras reais em paralelo) graças ao índice único
      // (user_id, pack_id, provider). Não pode virar idempotente cego: a
      // segunda compra pagou 30 dias e precisa estender a linha vencedora.
      if (isUniqueViolation(e)) {
        const winner = await db.query.subscriptions.findFirst({
          where: and(
            eq(schema.subscriptions.userId, result.userId),
            eq(schema.subscriptions.packId, result.packId),
            eq(schema.subscriptions.provider, providerName)
          ),
        });
        if (!winner) return conflictRenewal();
        // entrega duplicada do MESMO evento (mesmo providerId): guarda de
        // produção preservada, não estende de novo, devolve idempotente
        if (winner.providerId === result.providerId) return idempotent();
        const outcome = await extendSubscription(winner, {
          providerId: result.providerId,
        });
        if (!('updated' in outcome)) return outcome;
        return NextResponse.json({ ok: true });
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  }

  if (pack.credits && pack.credits > 0) {
    // No fake, cada clique do usuário é uma compra nova: description única por
    // chamada (com timestamp) para o ledger nunca travar a recompra como
    // idempotente. Em produção (POST), o providerId é único por pagamento e a
    // description estável garante a idempotência contra webhooks duplicados.
    const description = opts.fakeCreditsAlwaysGrant
      ? `Compra créditos (providerId ${result.providerId}) #${crypto.randomUUID()}`
      : `Compra créditos (providerId ${result.providerId})`;
    if (!opts.fakeCreditsAlwaysGrant) {
      const alreadyProcessed = await db.query.creditLedger.findFirst({
        where: and(
          eq(schema.creditLedger.userId, result.userId),
          eq(schema.creditLedger.kind, LEDGER_KIND),
          eq(schema.creditLedger.description, description)
        ),
      });
      if (alreadyProcessed) {
        return idempotent();
      }
    }
    try {
      await addCredits(result.userId, pack.credits, LEDGER_KIND, description);
    } catch (e) {
      // Corrida de webhooks: outro request já concedeu os créditos.
      if (isUniqueViolation(e)) return idempotent();
      throw e;
    }
  }
  return NextResponse.json({ ok: true });
}
