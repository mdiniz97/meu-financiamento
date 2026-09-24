import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listInvoicesForPayment, scheduleInvoiceOnce } from './invoice';

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
  'ASAAS_INVOICE_MUNICIPAL_SERVICE_ID',
  'ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE',
  'ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME',
  'ASAAS_INVOICE_ISS',
  'ASAAS_INVOICE_RETAIN_ISS',
  'ASAAS_INVOICE_OBSERVATIONS',
  'ASAAS_INVOICE_NBS_CODE',
  'ASAAS_INVOICE_TAX_SITUATION_CODE',
] as const;

const original = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  mocks.asaasFetch.mockReset();
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, {
    ASAAS_ENV: 'production',
    ASAAS_BASE_URL: 'https://api.asaas.com/v3',
    ASAAS_API_KEY: '$aact_prod_abc',
    ASAAS_WEBHOOK_AUTH_TOKEN: 'x'.repeat(32),
    ASAAS_INVOICE_ENABLED: 'true',
    ASAAS_INVOICE_MUNICIPAL_SERVICE_ID: '290420',
    ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME: 'Licenciamento de software',
    ASAAS_INVOICE_ISS: '5',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k]!;
  }
});

describe('listInvoicesForPayment', () => {
  it('consulta /invoices filtrando pelo pagamento e extrai o array `data`', async () => {
    mocks.asaasFetch.mockResolvedValue({ data: [{ id: 'inv_1' }], hasMore: false });

    await expect(listInvoicesForPayment('pay_1')).resolves.toEqual([{ id: 'inv_1' }]);
    const [cfg, path] = mocks.asaasFetch.mock.calls[0];
    expect(cfg).toMatchObject({ baseUrl: 'https://api.asaas.com/v3' });
    expect(path).toBe('/invoices?payment=pay_1&limit=100&offset=0');
  });

  it('retorna vazio quando não há notas', async () => {
    mocks.asaasFetch.mockResolvedValue({ data: [], hasMore: false });
    await expect(listInvoicesForPayment('pay_1')).resolves.toEqual([]);
  });
});

describe('scheduleInvoiceOnce', () => {
  it('agenda via POST /invoices com payment, serviço municipal e taxes', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce({ data: [], hasMore: false })
      .mockResolvedValueOnce({ id: 'inv_new', status: 'SCHEDULED' });

    const result = await scheduleInvoiceOnce({
      paymentId: 'pay_1',
      value: 10,
      effectiveDate: '2026-09-22',
      serviceDescription: 'Compra de créditos',
    });

    expect(result).toEqual({ id: 'inv_new', status: 'SCHEDULED' });
    expect(mocks.asaasFetch).toHaveBeenCalledTimes(2);

    const [, listPath] = mocks.asaasFetch.mock.calls[0];
    expect(listPath).toBe('/invoices?payment=pay_1&limit=100&offset=0');

    const [cfg, path, init] = mocks.asaasFetch.mock.calls[1];
    expect(cfg).toMatchObject({ baseUrl: 'https://api.asaas.com/v3' });
    expect(path).toBe('/invoices');
    expect(init.method).toBe('POST');
    expect(init.body).toMatchObject({
      payment: 'pay_1',
      value: 10,
      effectiveDate: '2026-09-22',
      serviceDescription: 'Compra de créditos',
      // `deductions` e `observations` são obrigatórios no DTO da API.
      deductions: 0,
      observations: expect.any(String),
      municipalServiceId: '290420',
      municipalServiceName: 'Licenciamento de software',
      taxes: expect.objectContaining({ iss: 5 }),
    });
    expect(init.body).not.toHaveProperty('municipalServiceCode');
  });

  it('permite sobrescrever deductions e observations quando informados', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce({ data: [], hasMore: false })
      .mockResolvedValueOnce({ id: 'inv_new' });

    await scheduleInvoiceOnce({
      paymentId: 'pay_1',
      value: 10,
      effectiveDate: '2026-09-22',
      serviceDescription: 'Compra',
      deductions: 1.5,
      observations: 'Mensal',
    });

    const [, , init] = mocks.asaasFetch.mock.calls[1];
    expect(init.body).toMatchObject({ deductions: 1.5, observations: 'Mensal' });
  });

  it('envia nbsCode (e afins) dentro de taxes, como exige o DTO de /invoices', async () => {
    process.env.ASAAS_INVOICE_NBS_CODE = '1.1103.22.00';
    process.env.ASAAS_INVOICE_TAX_SITUATION_CODE = '000';
    mocks.asaasFetch
      .mockResolvedValueOnce({ data: [], hasMore: false })
      .mockResolvedValueOnce({ id: 'inv_new' });

    await scheduleInvoiceOnce({
      paymentId: 'pay_1',
      value: 10,
      effectiveDate: '2026-09-22',
    });

    const [, , init] = mocks.asaasFetch.mock.calls[1];
    expect(init.body.taxes).toMatchObject({
      nbsCode: '1.1103.22.00',
      taxSituationCode: '000',
      iss: 5,
    });
    // Não deve vazar para o topo do body.
    expect(init.body).not.toHaveProperty('nbsCode');
  });

  it.each(['ERROR', 'CANCELED'])(
    'reemite quando a única nota existente está em %s (não é documento válido)',
    async (status) => {
      mocks.asaasFetch
        .mockResolvedValueOnce({ data: [{ id: 'inv_antiga', status }], hasMore: false })
        .mockResolvedValueOnce({ id: 'inv_nova', status: 'SCHEDULED' });

      await expect(
        scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
      ).resolves.toEqual({ id: 'inv_nova', status: 'SCHEDULED' });

      expect(mocks.asaasFetch).toHaveBeenCalledTimes(2);
    }
  );

  it('blocks reissue when a later page contains a live invoice', async () => {
    mocks.asaasFetch
      .mockResolvedValueOnce({ data: [{ id: 'inv_canceled', status: 'CANCELED' }], hasMore: true })
      .mockResolvedValueOnce({ data: [{ id: 'inv_live', status: 'AUTHORIZED' }], hasMore: false });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).resolves.toBeNull();

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(2);
    expect(mocks.asaasFetch.mock.calls.map(([, path]) => path)).toEqual([
      '/invoices?payment=pay_1&limit=100&offset=0',
      '/invoices?payment=pay_1&limit=100&offset=100',
    ]);
  });

  it('does not issue an invoice when a paginated response has no invoice list', async () => {
    mocks.asaasFetch.mockResolvedValueOnce({ hasMore: false });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).rejects.toThrow('Invalid Asaas invoice list response');

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
  });

  it('does not issue an invoice when pagination metadata is missing', async () => {
    mocks.asaasFetch.mockResolvedValueOnce({ data: [{ id: 'inv_canceled', status: 'CANCELED' }] });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).rejects.toThrow('Invalid Asaas invoice list response');

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
  });

  // `CANCELLATION_DENIED` é cancelamento RECUSADO: a nota continua valendo
  // (doc Asaas: "mantenha a nota fiscal sincronizada com o estado retornado").
  // Reemitir aqui emitiria um SEGUNDO documento fiscal para a mesma cobrança.
  it.each([
    'SCHEDULED',
    'SYNCHRONIZED',
    'AUTHORIZED',
    'PROCESSING_CANCELLATION',
    'CANCELLATION_DENIED',
  ])('não reemite quando a nota existente está em %s (documento vivo)', async (status) => {
    mocks.asaasFetch.mockResolvedValueOnce({ data: [{ id: 'inv_ok', status }], hasMore: false });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).resolves.toBeNull();

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
  });

  it('não reemite com status desconhecido (conservador)', async () => {
    mocks.asaasFetch.mockResolvedValueOnce({ data: [{ id: 'inv_x', status: 'STATUS_NOVO' }], hasMore: false });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).resolves.toBeNull();

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
  });

  it('não repete o POST quando já existe nota para o pagamento (idempotência)', async () => {
    mocks.asaasFetch.mockResolvedValueOnce({ data: [{ id: 'inv_existing' }], hasMore: false });

    await expect(
      scheduleInvoiceOnce({ paymentId: 'pay_1', value: 10, effectiveDate: '2026-09-22' })
    ).resolves.toBeNull();

    expect(mocks.asaasFetch).toHaveBeenCalledTimes(1);
  });
});
