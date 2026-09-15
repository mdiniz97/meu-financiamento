import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ headers: vi.fn() }));

vi.mock('next/headers', () => ({ headers: m.headers }));

import { assertSameOrigin } from './same-origin';

function headerMap(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  return { get: (key: string) => map.get(key.toLowerCase()) ?? null };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_URL', 'https://app.example');
  m.headers.mockResolvedValue(headerMap({}));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertSameOrigin', () => {
  it('permite quando o Origin bate com o host do APP_URL', async () => {
    m.headers.mockResolvedValue(
      headerMap({ origin: 'https://app.example', host: 'app.example' })
    );

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it('bloqueia quando o Origin diverge', async () => {
    m.headers.mockResolvedValue(headerMap({ origin: 'https://evil.example' }));

    await expect(assertSameOrigin()).rejects.toThrow(/origem/i);
  });

  it('bloqueia quando o esquema diverge (http vs https) com host igual', async () => {
    m.headers.mockResolvedValue(
      headerMap({ origin: 'http://app.example', host: 'app.example' })
    );

    await expect(assertSameOrigin()).rejects.toThrow(/esquema/i);
  });

  it('bloqueia quando o host do header diverge do APP_URL', async () => {
    m.headers.mockResolvedValue(
      headerMap({ origin: 'https://app.example', host: 'evil.example' })
    );

    await expect(assertSameOrigin()).rejects.toThrow(/host/i);
  });

  it('permite Origin ausente no ambiente de teste', async () => {
    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it('bloqueia Origin ausente em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(assertSameOrigin()).rejects.toThrow();
  });

  it('bloqueia Origin inválido', async () => {
    m.headers.mockResolvedValue(headerMap({ origin: 'not-a-url' }));

    await expect(assertSameOrigin()).rejects.toThrow();
  });
});
