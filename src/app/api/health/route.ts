import { NextResponse } from 'next/server';

// Healthcheck do Railway: leve, sem tocar no banco (o release step roda as
// migrações antes). `no-store` evita cache no Cloudflare/proxy.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { ok: true, status: 'healthy' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
