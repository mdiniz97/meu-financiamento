import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEmailConfig: vi.fn(),
}));

vi.mock('./config', () => ({ getEmailConfig: mocks.getEmailConfig }));

import { EmailApiError, sendEmail } from './client';

beforeEach(() => {
  mocks.getEmailConfig.mockReset().mockReturnValue({
    apiKey: 're_test',
    from: 'amortiza.me <financeiro@amortiza.me>',
    replyTo: 'contato@amortiza.me',
  });
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(init: { ok: boolean; status: number; json?: unknown; text?: string }) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status,
    json: async () => init.json ?? {},
    text: async () => init.text ?? '',
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('sendEmail', () => {
  it('faz POST no Resend com Bearer, from, reply_to e destinatário', async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: { id: 'email_1' } });

    const out = await sendEmail({ to: 'cliente@example.com', subject: 'Oi', html: '<p>Oi</p>' });

    expect(out).toEqual({ id: 'email_1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toMatchObject({
      from: 'amortiza.me <financeiro@amortiza.me>',
      to: ['cliente@example.com'],
      subject: 'Oi',
      html: '<p>Oi</p>',
      reply_to: 'contato@amortiza.me',
    });
  });

  it('omite reply_to quando a config não traz', async () => {
    mocks.getEmailConfig.mockReturnValue({ apiKey: 're_test', from: 'a@b.com' });
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: { id: 'email_2' } });

    await sendEmail({ to: 'x@y.com', subject: 'S', html: '<p>x</p>' });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBeUndefined();
  });

  it('lança EmailApiError com status e corpo em resposta não-ok', async () => {
    mockFetchOnce({ ok: false, status: 422, text: '{"message":"invalid from"}' });

    await expect(sendEmail({ to: 'x@y.com', subject: 'S', html: '<p>x</p>' })).rejects.toBeInstanceOf(
      EmailApiError
    );
  });

  it('propaga timeout como EmailApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
    );

    await expect(
      sendEmail({ to: 'x@y.com', subject: 'S', html: '<p>x</p>' })
    ).rejects.toBeInstanceOf(EmailApiError);
  });
});
