import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runDunning } from '@/lib/subscriptions/dunning';

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runDunning();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'dunning failed' }, { status: 500 });
  }
}

export const POST = GET;
