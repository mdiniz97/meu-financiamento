import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runTrialReminder } from '@/lib/trial-reminder/send';

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await runTrialReminder(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'trial reminder failed' }, { status: 500 });
  }
}
export const POST = GET;
