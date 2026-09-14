import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  auth: vi.fn(),
  headers: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
  reactivateSubscription: vi.fn(),
  subsFindFirst: vi.fn(),
  eventsFindMany: vi.fn(),
  insertValues: vi.fn(),
  insert: vi.fn(),
  updateWhere: vi.fn(),
  updateSet: vi.fn(),
  update: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }));
vi.mock('next/headers', () => ({ headers: m.headers }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  cancelAtPeriodEnd: m.cancelAtPeriodEnd,
  reactivateSubscription: m.reactivateSubscription,
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  gte: (...args: unknown[]) => args,
  ne: (field: unknown, value: unknown) => ({ op: 'ne', field, value }),
}));
vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findFirst: m.subsFindFirst },
      subscriptionEvents: { findMany: m.eventsFindMany },
    },
    insert: m.insert,
    update: m.update,
  },
  schema: {
    subscriptions: {
      id: 'subscriptions.id',
      userId: 'subscriptions.user_id',
      packId: 'subscriptions.pack_id',
      provider: 'subscriptions.provider',
    },
    subscriptionEvents: {
      userId: 'subscription_events.user_id',
      result: 'subscription_events.result',
      createdAt: 'subscription_events.created_at',
    },
  },
}));

import { cancelSubscription, reactivateSubscriptionAction } from './actions';

function headerMap(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  return { get: (key: string) => map.get(key.toLowerCase()) ?? null };
}

function ownSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-own',
    asaasSubscriptionId: 'asaas_own',
    cancelAtPeriodEnd: false,
    status: 'active',
    currentPeriodEnd: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_URL', 'https://app.example');
  m.insert.mockImplementation(() => ({ values: m.insertValues }));
  m.insertValues.mockResolvedValue(undefined);
  m.update.mockImplementation(() => ({ set: m.updateSet }));
  m.updateSet.mockImplementation(() => ({ where: m.updateWhere }));
  m.updateWhere.mockResolvedValue(undefined);
  m.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  m.headers.mockResolvedValue(headerMap({}));
  m.auth.mockResolvedValue({ userId: 'user-1' });
  m.subsFindFirst.mockResolvedValue(ownSubscription());
  m.eventsFindMany.mockResolvedValue([]);
  m.cancelAtPeriodEnd.mockResolvedValue(undefined);
  m.reactivateSubscription.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cancelSubscription', () => {
  it('manda para o login quando não autenticado (sem tocar o Asaas)', async () => {
    m.auth.mockResolvedValue(null);

    await expect(cancelSubscription()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=/assinatura'
    );

    expect(m.subsFindFirst).not.toHaveBeenCalled();
    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('bloqueia quando o Origin diverge (antes de qualquer efeito)', async () => {
    m.headers.mockResolvedValue(headerMap({ origin: 'https://evil.example' }));

    await expect(cancelSubscription()).rejects.toThrow(/origem/i);

    expect(m.auth).not.toHaveBeenCalled();
    expect(m.subsFindFirst).not.toHaveBeenCalled();
    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('IDOR: age só sobre a assinatura do usuário da sessão', async () => {
    m.subsFindFirst.mockImplementation(({ where }: { where: unknown }) => {
      const isOwn = JSON.stringify(where).includes('user-1');
      return Promise.resolve(
        isOwn
          ? ownSubscription()
          : { id: 'sub-other', asaasSubscriptionId: 'asaas_other', cancelAtPeriodEnd: false }
      );
    });

    await cancelSubscription();

    const where = m.subsFindFirst.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('user-1');
    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_own');
    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalledWith('asaas_other');
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-own']);
    expect(m.updateWhere).not.toHaveBeenCalledWith(['subscriptions.id', 'sub-other']);
  });

  it('recusa sem chamar o Asaas quando o rate limit estoura, registrando rate_limited', async () => {
    m.eventsFindMany.mockResolvedValue([{}, {}, {}, {}, {}]);

    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', result: 'rate_limited' })
    );
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it('cancela no Asaas, persiste local, registra evento e revalida', async () => {
    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_own');
    expect(m.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true })
    );
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', result: 'ok' })
    );
    expect(m.revalidatePath).toHaveBeenCalledWith('/assinatura');
    expect(m.revalidatePath).toHaveBeenCalledWith('/perfil');
  });

  it('registra no_subscription quando o usuário não tem assinatura', async () => {
    m.subsFindFirst.mockResolvedValue(null);

    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', result: 'no_subscription' })
    );
  });

  it('I2: propaga erro do Asaas, audita error e não revalida', async () => {
    m.cancelAtPeriodEnd.mockRejectedValue(new Error('asaas down'));

    await expect(cancelSubscription()).rejects.toThrow('asaas down');

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', result: 'error' })
    );
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('reactivateSubscriptionAction', () => {
  it('manda para o login quando não autenticado', async () => {
    m.auth.mockResolvedValue(null);

    await expect(reactivateSubscriptionAction()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=/assinatura'
    );

    expect(m.reactivateSubscription).not.toHaveBeenCalled();
  });

  it('reativa no Asaas com nextDueDate do período pago e limpa flags', async () => {
    const periodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    m.subsFindFirst.mockResolvedValue(
      ownSubscription({ cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd })
    );

    await reactivateSubscriptionAction();

    expect(m.reactivateSubscription).toHaveBeenCalledWith(
      'asaas_own',
      periodEnd.toISOString().slice(0, 10)
    );
    expect(m.updateSet).toHaveBeenCalledWith({ cancelAtPeriodEnd: false, canceledAt: null });
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate', result: 'ok' })
    );
    expect(m.revalidatePath).toHaveBeenCalledWith('/assinatura');
    expect(m.revalidatePath).toHaveBeenCalledWith('/perfil');
  });

  it('recusa por rate limit sem chamar o Asaas', async () => {
    m.eventsFindMany.mockResolvedValue([{}, {}, {}, {}, {}]);

    await reactivateSubscriptionAction();

    expect(m.reactivateSubscription).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate', result: 'rate_limited' })
    );
  });

  it('IDOR: reativa a assinatura do usuário da sessão, ignorando outra', async () => {
    m.subsFindFirst.mockImplementation(({ where }: { where: unknown }) => {
      const isOwn = JSON.stringify(where).includes('user-1');
      return Promise.resolve(
        isOwn
          ? ownSubscription({ cancelAtPeriodEnd: true })
          : {
              id: 'sub-other',
              asaasSubscriptionId: 'asaas_other',
              cancelAtPeriodEnd: true,
              status: 'active',
              currentPeriodEnd: null,
            }
      );
    });

    await reactivateSubscriptionAction();

    expect(m.reactivateSubscription).toHaveBeenCalledWith('asaas_own', expect.any(String));
    expect(m.reactivateSubscription).not.toHaveBeenCalledWith(
      'asaas_other',
      expect.any(String)
    );
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-own']);
    expect(m.updateWhere).not.toHaveBeenCalledWith(['subscriptions.id', 'sub-other']);
  });

  it('I3: status canceled/expired não chama o Asaas', async () => {
    m.subsFindFirst.mockResolvedValue(
      ownSubscription({ cancelAtPeriodEnd: true, status: 'canceled' })
    );

    await reactivateSubscriptionAction();

    expect(m.reactivateSubscription).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate', result: 'no_subscription' })
    );
  });
});
