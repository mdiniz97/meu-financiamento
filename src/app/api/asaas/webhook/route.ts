import { NextResponse, after } from 'next/server';
import { db, schema } from '@/db';
import { getAsaasConfig } from '@/lib/payments/asaas/config';
import { parseAsaasEvent, verifyAsaasToken } from '@/lib/payments/asaas/webhook';
import { processWebhookEvent, sanitizeEventForStorage } from '@/lib/subscriptions/apply-event';

function isAllowedWebhookIp(req: Request): boolean {
  const allowlist = process.env.ASAAS_WEBHOOK_IP_ALLOWLIST;
  if (!allowlist?.trim()) return true;

  const allowed = allowlist
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  const forwarded = req.headers.get('x-forwarded-for');
  const clientIp = (forwarded ?? req.headers.get('x-real-ip') ?? '').split(',')[0]?.trim();
  return allowed.includes(clientIp);
}

export async function POST(req: Request) {
  if (!isAllowedWebhookIp(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const cfg = getAsaasConfig();
  const token = req.headers.get('asaas-access-token');
  if (!verifyAsaasToken(token, cfg.webhookToken)) {
    return NextResponse.json({ error: 'token inválido' }, { status: 401 });
  }

  const body = await req.text();
  const evt = parseAsaasEvent(body);
  if (!evt) return NextResponse.json({ error: 'payload inválido' }, { status: 400 });

  const inserted = await db
    .insert(schema.webhookEvents)
    .values({
      asaasEventId: evt.id,
      event: evt.event,
      payload: sanitizeEventForStorage(evt),
    })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvents.id });

  const rowId = inserted[0]?.id;
  if (rowId) after(() => processWebhookEvent(rowId));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
