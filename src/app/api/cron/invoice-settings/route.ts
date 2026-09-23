import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { refreshSubscriptionInvoiceSettings } from '@/lib/subscriptions/invoice-refresh';

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await refreshSubscriptionInvoiceSettings();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'invoice settings refresh failed' }, { status: 500 });
  }
}

export const POST = GET;
