import type { AsaasConfig } from './config';

export class AsaasApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`Asaas API ${status}`);
    this.name = 'AsaasApiError';
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
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
    const parsed = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) throw new AsaasApiError(res.status, parsed);
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}
