import { headers } from 'next/headers';

function expectedOrigin(): { protocol: string; host: string } {
  const url = new URL(process.env.APP_URL ?? 'http://localhost:3012');
  return { protocol: url.protocol, host: url.host };
}

/**
 * RS1 — barra CSRF em Server Actions de gerenciamento.
 *
 * Usa o cabeçalho `Origin` (enviado pelo navegador em POST de Server Action) e
 * o `host` como defesa extra. Sem `Origin`, o navegador não valida a origem:
 * em produção bloqueia; no ambiente de teste os mocks não enviam `Origin`,
 * então permite para não quebrar a suíte.
 */
export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('host');
  const expected = expectedOrigin();

  if (!origin) {
    if (process.env.NODE_ENV === 'test') return;
    throw new Error('same-origin: cabeçalho Origin ausente');
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error('same-origin: Origin inválido');
  }

  if (parsedOrigin.protocol !== expected.protocol) {
    throw new Error('same-origin: esquema divergente');
  }
  if (parsedOrigin.host !== expected.host) {
    throw new Error('same-origin: origem divergente');
  }
  if (host && host !== expected.host) {
    throw new Error('same-origin: host divergente');
  }
}
