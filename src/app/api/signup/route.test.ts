import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirstUser: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  hash: vi.fn(),
  isEmailEnabled: vi.fn(),
  sendEmail: vi.fn(),
  welcomeEmail: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: { users: { findFirst: mocks.findFirstUser } },
    transaction: mocks.transaction,
  },
  schema: { users: { email: 'email' }, creditLedger: {} },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }));
vi.mock('@/lib/auth-mode', () => ({ emailLoginEnabled: () => true }));
vi.mock('@/lib/email/config', () => ({ isEmailEnabled: mocks.isEmailEnabled }));
vi.mock('@/lib/email/client', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/email/templates', () => ({ welcomeEmail: mocks.welcomeEmail }));

import { POST } from './route';

const CREATED = { id: 'user-1', name: 'Maria Silva', email: 'maria@exemplo.com' };

function req(body: unknown) {
  return new Request('http://localhost/api/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const VALID = { name: 'Maria Silva', email: 'Maria@Exemplo.com', password: 'segredo123' };

beforeEach(() => {
  mocks.findFirstUser.mockReset().mockResolvedValue(undefined);
  mocks.returning.mockReset().mockResolvedValue([CREATED]);
  mocks.values.mockReset().mockReturnValue({ returning: mocks.returning });
  mocks.insert.mockReset().mockReturnValue({ values: mocks.values });
  mocks.transaction.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ insert: mocks.insert })
  );
  mocks.hash.mockReset().mockResolvedValue('hash');
  mocks.isEmailEnabled.mockReset().mockReturnValue(true);
  mocks.sendEmail.mockReset().mockResolvedValue({ id: 'email_1' });
  mocks.welcomeEmail.mockReset().mockReturnValue({ subject: 'S', html: '<p>h</p>', text: 't' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/signup', () => {
  it('cria a conta e envia boas-vindas com o mesmo bônus do ledger', async () => {
    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(mocks.welcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria Silva', credits: 2 })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'maria@exemplo.com', subject: 'S' })
    );
    const bonus = mocks.values.mock.calls.find((c) => (c[0] as { kind?: string }).kind === 'bonus');
    expect((bonus?.[0] as { amount: number }).amount).toBe(2);
  });

  it('não envia quando o e-mail está desabilitado', async () => {
    mocks.isEmailEnabled.mockReturnValue(false);

    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('falha no envio NÃO quebra o cadastro', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('Resend 500'));

    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[signup] falha ao enviar boas-vindas')
    );
  });

  it('não tenta enviar se o e-mail já existe', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'existente' });

    const res = await POST(req(VALID));

    expect(res.status).toBe(409);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
