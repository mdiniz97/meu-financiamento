import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEmailConfig, isEmailEnabled } from './config';

const KEYS = ['EMAIL_ENABLED', 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO'] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    original[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('isEmailEnabled', () => {
  it('false por padrão (fail-closed)', () => {
    expect(isEmailEnabled()).toBe(false);
  });

  it('false quando só a flag está ligada', () => {
    process.env.EMAIL_ENABLED = 'true';
    expect(isEmailEnabled()).toBe(false);
  });

  it('false quando falta EMAIL_FROM', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.RESEND_API_KEY = 're_test';
    expect(isEmailEnabled()).toBe(false);
  });

  it('true com flag, chave e remetente', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'amortiza.me <financeiro@amortiza.me>';
    expect(isEmailEnabled()).toBe(true);
  });
});

describe('getEmailConfig', () => {
  it('lança sem configuração completa', () => {
    expect(() => getEmailConfig()).toThrow(/RESEND_API_KEY/);
  });

  it('monta a config e omite replyTo ausente', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'amortiza.me <financeiro@amortiza.me>';

    expect(getEmailConfig()).toEqual({
      apiKey: 're_test',
      from: 'amortiza.me <financeiro@amortiza.me>',
    });
  });

  it('inclui replyTo quando definido', () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'amortiza.me <financeiro@amortiza.me>';
    process.env.EMAIL_REPLY_TO = 'contato@amortiza.me';

    expect(getEmailConfig().replyTo).toBe('contato@amortiza.me');
  });
});
