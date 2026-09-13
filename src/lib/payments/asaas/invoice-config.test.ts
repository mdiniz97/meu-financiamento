import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsaasApiError } from './client';
import { isInvoiceEnabled, invoiceSettingsBody } from './invoice-config';
import { configureInvoiceSettings, getFiscalInfo } from './subscription';

const mocks = vi.hoisted(() => ({ asaasFetch: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  return { ...actual, asaasFetch: mocks.asaasFetch };
});

const ENV_KEYS = [
  'ASAAS_ENV',
  'ASAAS_BASE_URL',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_AUTH_TOKEN',
  'ASAAS_INVOICE_ENABLED',
  'ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE',
  'ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME',
  'ASAAS_INVOICE_EFFECTIVE_PERIOD',
  'ASAAS_INVOICE_RETAIN_ISS',
  'ASAAS_INVOICE_ISS',
  'ASAAS_INVOICE_PIS',
  'ASAAS_INVOICE_COFINS',
  'ASAAS_INVOICE_CSLL',
  'ASAAS_INVOICE_INSS',
  'ASAAS_INVOICE_IR',
  'ASAAS_INVOICE_NBS_CODE',
  'ASAAS_INVOICE_TAX_SITUATION_CODE',
  'ASAAS_INVOICE_TAX_CLASSIFICATION_CODE',
  'ASAAS_INVOICE_OPERATION_INDICATOR_CODE',
  'ASAAS_INVOICE_OBSERVATIONS',
] as const;

const original = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  vi.restoreAllMocks();
  mocks.asaasFetch.mockReset();
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k]!;
  }
});

function baseEnv(over: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  Object.assign(process.env, {
    ASAAS_ENV: 'sandbox',
    ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3',
    ASAAS_API_KEY: '$aact_hmlg_abc',
    ASAAS_WEBHOOK_AUTH_TOKEN: 'x'.repeat(32),
    ...over,
  });
}

function clearInvoiceEnv() {
  for (const k of ENV_KEYS) {
    if (k.startsWith('ASAAS_INVOICE_')) delete process.env[k];
  }
}

describe('isInvoiceEnabled', () => {
  it('é false por default (env ausente)', () => {
    clearInvoiceEnv();
    expect(isInvoiceEnabled()).toBe(false);
  });

  it('é false para qualquer valor diferente de "true"', () => {
    clearInvoiceEnv();
    process.env.ASAAS_INVOICE_ENABLED = '1';
    expect(isInvoiceEnabled()).toBe(false);
    process.env.ASAAS_INVOICE_ENABLED = 'TRUE';
    expect(isInvoiceEnabled()).toBe(false);
    process.env.ASAAS_INVOICE_ENABLED = 'yes';
    expect(isInvoiceEnabled()).toBe(false);
  });

  it('é true somente com "true"', () => {
    clearInvoiceEnv();
    process.env.ASAAS_INVOICE_ENABLED = 'true';
    expect(isInvoiceEnabled()).toBe(true);
  });
});

describe('invoiceSettingsBody', () => {
  it('monta o body exato com defaults 0/false', () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Consultoria',
    });

    expect(invoiceSettingsBody()).toEqual({
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
      municipalServiceCode: '0107',
      municipalServiceName: 'Consultoria',
      taxes: { retainIss: false, iss: 0, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 0 },
    });
  });

  it('parseia números e booleanos quando presentes', () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Consultoria',
      ASAAS_INVOICE_RETAIN_ISS: 'true',
      ASAAS_INVOICE_ISS: '5',
      ASAAS_INVOICE_PIS: '1.5',
      ASAAS_INVOICE_COFINS: '2',
      ASAAS_INVOICE_CSLL: '3',
      ASAAS_INVOICE_INSS: '4',
      ASAAS_INVOICE_IR: '1.2',
    });

    expect(invoiceSettingsBody()).toMatchObject({
      taxes: { retainIss: true, iss: 5, pis: 1.5, cofins: 2, csll: 3, inss: 4, ir: 1.2 },
    });
  });

  it('inclui opcionais somente quando definidos e respeita effectiveDatePeriod', () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Consultoria',
      ASAAS_INVOICE_EFFECTIVE_PERIOD: 'ON_PAYMENT_DUE_DATE',
      ASAAS_INVOICE_NBS_CODE: '1.0101',
      ASAAS_INVOICE_TAX_SITUATION_CODE: '3',
      ASAAS_INVOICE_TAX_CLASSIFICATION_CODE: '01',
      ASAAS_INVOICE_OPERATION_INDICATOR_CODE: '1',
      ASAAS_INVOICE_OBSERVATIONS: 'NFS-e emitida automaticamente',
    });

    const body = invoiceSettingsBody();
    expect(body).toMatchObject({
      effectiveDatePeriod: 'ON_PAYMENT_DUE_DATE',
      nbsCode: '1.0101',
      taxSituationCode: '3',
      taxClassificationCode: '01',
      operationIndicatorCode: '1',
      observations: 'NFS-e emitida automaticamente',
    });
  });

  it('não inclui campos opcionais ausentes', () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Consultoria',
    });

    const body = invoiceSettingsBody();
    expect(body).not.toHaveProperty('nbsCode');
    expect(body).not.toHaveProperty('taxSituationCode');
    expect(body).not.toHaveProperty('observations');
  });

  it('lança no uso quando habilitado sem municipalServiceCode', () => {
    clearInvoiceEnv();
    baseEnv({ ASAAS_INVOICE_ENABLED: 'true' });
    expect(() => invoiceSettingsBody()).toThrow(/MUNICIPAL_SERVICE_CODE/);
  });

  it('lança com effectiveDatePeriod inválido quando habilitado', () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_EFFECTIVE_PERIOD: 'NOPE',
    });
    expect(() => invoiceSettingsBody()).toThrow(/EFFECTIVE_PERIOD/);
  });
});

describe('configureInvoiceSettings', () => {
  it('faz POST /subscriptions/{id}/invoiceSettings com o body exato', async () => {
    clearInvoiceEnv();
    baseEnv({
      ASAAS_INVOICE_ENABLED: 'true',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE: '0107',
      ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Consultoria',
      ASAAS_INVOICE_RETAIN_ISS: 'true',
      ASAAS_INVOICE_IR: '1.2',
    });
    mocks.asaasFetch.mockResolvedValue({});

    await configureInvoiceSettings('sub_1');

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
    const [cfg, path, init] = mocks.asaasFetch.mock.calls[0];
    expect(cfg).toMatchObject({ baseUrl: 'https://api-sandbox.asaas.com/v3' });
    expect(path).toBe('/subscriptions/sub_1/invoiceSettings');
    expect(init.method).toBe('POST');
    expect(init.body).toEqual({
      effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
      municipalServiceCode: '0107',
      municipalServiceName: 'Consultoria',
      taxes: { retainIss: true, iss: 0, pis: 0, cofins: 0, csll: 0, inss: 0, ir: 1.2 },
    });
  });
});

describe('getFiscalInfo', () => {
  it('ok:true quando o GET /fiscalInfo/ responde 200', async () => {
    baseEnv();
    mocks.asaasFetch.mockResolvedValue({});

    await expect(getFiscalInfo()).resolves.toEqual({ ok: true });
    expect(mocks.asaasFetch.mock.calls[0][1]).toBe('/fiscalInfo/');
  });

  it('ok:false quando /fiscalInfo/ responde 404', async () => {
    baseEnv();
    mocks.asaasFetch.mockRejectedValue(new AsaasApiError(404, { errors: [] }));

    await expect(getFiscalInfo()).resolves.toEqual({ ok: false });
  });

  it('propaga erros que não sejam 404', async () => {
    baseEnv();
    mocks.asaasFetch.mockRejectedValue(new AsaasApiError(500, {}));

    await expect(getFiscalInfo()).rejects.toBeInstanceOf(AsaasApiError);
  });
});
