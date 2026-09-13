import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileSubscriptions } from '@/lib/subscriptions/reconcile';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await reconcileSubscriptions();
  return NextResponse.json(result);
}

export const POST = GET;
