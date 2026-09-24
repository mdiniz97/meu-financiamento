import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirstUser: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  hash: vi.fn(),
  sendWelcomeEmail: vi.fn(),
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
vi.mock('@/lib/email/notify', () => ({
  sendWelcomeEmail: mocks.sendWelcomeEmail,
  WELCOME_BONUS_CREDITS: 2,
}));

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
  mocks.sendWelcomeEmail.mockReset().mockResolvedValue(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/signup', () => {
  it('cria a conta e envia boas-vindas com o mesmo bônus do ledger', async () => {
    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(mocks.sendWelcomeEmail).toHaveBeenCalledWith({
      name: 'Maria Silva',
      email: 'maria@exemplo.com',
    });
    const bonus = mocks.values.mock.calls.find((c) => (c[0] as { kind?: string }).kind === 'bonus');
    expect((bonus?.[0] as { amount: number }).amount).toBe(2);
  });

  it('chama o envio de boas-vindas (que é best-effort por contrato)', async () => {
    const res = await POST(req(VALID));

    expect(res.status).toBe(201);
    expect(mocks.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('não tenta enviar se o e-mail já existe', async () => {
    mocks.findFirstUser.mockResolvedValue({ id: 'existente' });

    const res = await POST(req(VALID));

    expect(res.status).toBe(409);
    expect(mocks.sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
