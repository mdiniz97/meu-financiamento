import { afterEach, describe, expect, it } from 'vitest';
import { getAsaasConfig } from './config';

const KEYS = ['ASAAS_ENV', 'ASAAS_BASE_URL', 'ASAAS_API_KEY', 'ASAAS_WEBHOOK_AUTH_TOKEN'] as const;
const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k]!;
  }
});

const setEnv = (over: Partial<Record<(typeof KEYS)[number], string>> = {}) => {
  process.env.ASAAS_ENV = 'sandbox';
  process.env.ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3';
  process.env.ASAAS_API_KEY = '$aact_hmlg_abc';
  process.env.ASAAS_WEBHOOK_AUTH_TOKEN = 'x'.repeat(32);
  Object.assign(process.env, over);
};

describe('getAsaasConfig', () => {
  it('lê sandbox válido', () => {
    setEnv();
    expect(getAsaasConfig()).toMatchObject({
      env: 'sandbox',
      baseUrl: 'https://api-sandbox.asaas.com/v3',
      apiKey: '$aact_hmlg_abc',
    });
  });

  it('lança se chave sandbox em produção', () => {
    setEnv({ ASAAS_ENV: 'production', ASAAS_BASE_URL: 'https://api.asaas.com/v3', ASAAS_API_KEY: '$aact_hmlg_abc' });
    expect(() => getAsaasConfig()).toThrow(/sandbox.*produção/i);
  });

  it('lança se webhook token < 32 chars', () => {
    setEnv({ ASAAS_WEBHOOK_AUTH_TOKEN: 'curto' });
    expect(() => getAsaasConfig()).toThrow(/32/);
  });
});
