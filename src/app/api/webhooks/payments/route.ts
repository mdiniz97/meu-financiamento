import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getPaymentProvider } from '@/lib/payments';
import { addCredits } from '@/lib/credits';

const SUBSCRIPTION_DAYS = 30;
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
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') !== 'fake') {
    return NextResponse.json({ error: 'Método não permitido' }, { status: 405 });
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
  const result = await getPaymentProvider().verifyWebhook(
    JSON.stringify({ userId, packId }),
    null
  );
  if (!result) {
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 });
  }
  return processPayment(result);
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

async function processPayment(result: {
  userId: string;
  packId: string;
  providerId: string;
}) {
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
      return idempotent();
    }
    const providerName = process.env.PAYMENT_PROVIDER ?? 'fake';
    const periodEnd = new Date(
      Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
    );
    const current = await db.query.subscriptions.findFirst({
      where: and(
        eq(schema.subscriptions.userId, result.userId),
        eq(schema.subscriptions.packId, result.packId),
        eq(schema.subscriptions.provider, providerName)
      ),
    });
    try {
      if (current) {
        await db
          .update(schema.subscriptions)
          .set({
            providerId: result.providerId,
            status: 'active',
            currentPeriodEnd: periodEnd,
          })
          .where(eq(schema.subscriptions.id, current.id));
      } else {
        await db.insert(schema.subscriptions).values({
          userId: result.userId,
          packId: result.packId,
          provider: providerName,
          providerId: result.providerId,
          status: 'active',
          currentPeriodEnd: periodEnd,
        });
      }
    } catch (e) {
      // Corrida de webhooks: outro request já inseriu a mesma assinatura.
      if (isUniqueViolation(e)) return idempotent();
      throw e;
    }
    return NextResponse.json({ ok: true });
  }

  if (pack.credits && pack.credits > 0) {
    const description = `Compra créditos (providerId ${result.providerId})`;
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
