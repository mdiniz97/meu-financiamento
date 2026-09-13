import type { AsaasConfig } from './config';

export class AsaasApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    const detail = body === undefined || body === null ? '' : `: ${JSON.stringify(body)}`;
    super(`Asaas API ${status}${detail}`);
    this.name = 'AsaasApiError';
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function asaasFetch<T>(
  cfg: AsaasConfig,
  path: string,
  init: FetchOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 60_000);
  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        access_token: cfg.apiKey,
        'User-Agent': 'amortiza/1.0',
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const text = await res.text();
    const parsed = parseBody(text);
    if (!res.ok) throw new AsaasApiError(res.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}
