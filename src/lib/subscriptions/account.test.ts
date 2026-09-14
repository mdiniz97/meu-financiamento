import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
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

import {
  cancelOwnSubscription,
  getOwnSubscription,
  nextDueDateFor,
  rateLimitOk,
  reactivateOwnSubscription,
} from './account';

/**
 * Emula o WHERE do Postgres sobre um conjunto sintético, para exercitar o
 * filtro de `rate_limited` sem banco real.
 */
function matchesWhere(where: unknown[], row: Record<string, unknown>): boolean {
  return where.every((cond) => {
    if (cond && typeof cond === 'object' && 'op' in (cond as object)) {
      const c = cond as { op: string; field: string; value: unknown };
      if (c.op === 'ne') return row[c.field] !== c.value;
      return true;
    }
    const [field, value] = cond as [string, unknown];
    if (value instanceof Date) {
      return (row[field] as Date).getTime() >= value.getTime();
    }
    return row[field] === value;
  });
}

function windowRows(result: string, count: number) {
  return Array.from({ length: count }, () => ({
    'subscription_events.user_id': 'user-1',
    'subscription_events.result': result,
    'subscription_events.created_at': new Date(),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.insert.mockImplementation(() => ({ values: m.insertValues }));
  m.insertValues.mockResolvedValue(undefined);
  m.update.mockImplementation(() => ({ set: m.updateSet }));
  m.updateSet.mockImplementation(() => ({ where: m.updateWhere }));
  m.updateWhere.mockResolvedValue(undefined);
  m.cancelAtPeriodEnd.mockResolvedValue(undefined);
  m.reactivateSubscription.mockResolvedValue(undefined);
  m.eventsFindMany.mockResolvedValue([]);
});

describe('getOwnSubscription', () => {
  it('filtra por userId + pack unlimited + provider asaas (nunca por id do cliente)', async () => {
    m.subsFindFirst.mockResolvedValue({ id: 'sub-own' });

    await getOwnSubscription('user-1');

    const where = m.subsFindFirst.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.arrayContaining([
        ['subscriptions.user_id', 'user-1'],
        ['subscriptions.pack_id', 'unlimited'],
        ['subscriptions.provider', 'asaas'],
      ])
    );
    expect(m.subsFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe('rateLimitOk', () => {
  it('libera abaixo do limite', async () => {
    m.eventsFindMany.mockResolvedValue([{}, {}, {}, {}]);

    expect(await rateLimitOk('user-1')).toBe(true);
  });

  it('bloqueia a partir de 5 eventos na janela', async () => {
    m.eventsFindMany.mockResolvedValue([{}, {}, {}, {}, {}]);

    expect(await rateLimitOk('user-1')).toBe(false);
  });

  it('conta apenas os eventos do usuário nos últimos 60s', async () => {
    await rateLimitOk('user-1');

    const where = m.eventsFindMany.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.arrayContaining([['subscription_events.user_id', 'user-1']])
    );
    const [, since] = where[1] as [string, Date];
    expect(since).toBeInstanceOf(Date);
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(59_000);
    expect(Date.now() - since.getTime()).toBeLessThanOrEqual(61_000);
  });

  it('I1: não se auto-bloqueia — rate_limited não conta na janela', async () => {
    const rows = windowRows('rate_limited', 5);
    m.eventsFindMany.mockImplementation(({ where }: { where: unknown }) =>
      Promise.resolve(rows.filter((row) => matchesWhere(where as unknown[], row)))
    );

    expect(await rateLimitOk('user-1')).toBe(true);
  });

  it('I1: ainda bloqueia com 5 tentativas reais na janela', async () => {
    const rows = windowRows('ok', 5);
    m.eventsFindMany.mockImplementation(({ where }: { where: unknown }) =>
      Promise.resolve(rows.filter((row) => matchesWhere(where as unknown[], row)))
    );

    expect(await rateLimitOk('user-1')).toBe(false);
  });
});

describe('cancelOwnSubscription', () => {
  it('cancela no Asaas, marca local e registra evento ok', async () => {
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: false,
    });

    expect(await cancelOwnSubscription('user-1')).toBe('ok');

    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_own');
    expect(m.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true })
    );
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-own']);
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancel',
        result: 'ok',
        subscriptionId: 'sub-own',
      })
    );
  });

  it('IDOR: usa a assinatura do usuário da sessão e ignora outra', async () => {
    m.subsFindFirst.mockImplementation(({ where }: { where: unknown }) => {
      const isOwn = JSON.stringify(where).includes('user-1');
      return Promise.resolve(
        isOwn
          ? { id: 'sub-own', asaasSubscriptionId: 'asaas_own', cancelAtPeriodEnd: false }
          : { id: 'sub-other', asaasSubscriptionId: 'asaas_other', cancelAtPeriodEnd: false }
      );
    });

    await cancelOwnSubscription('user-1');

    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_own');
    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalledWith('asaas_other');
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-own']);
    expect(m.updateWhere).not.toHaveBeenCalledWith(['subscriptions.id', 'sub-other']);
  });

  it('é idempotente: não repete a chamada ao Asaas se já cancelada', async () => {
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: true,
    });

    expect(await cancelOwnSubscription('user-1')).toBe('ok');

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', result: 'ok' })
    );
  });

  it('registra no_subscription sem tocar o Asaas quando não há assinatura', async () => {
    m.subsFindFirst.mockResolvedValue(null);

    expect(await cancelOwnSubscription('user-1')).toBe('no_subscription');

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancel',
        result: 'no_subscription',
        subscriptionId: null,
      })
    );
  });

  it('I2: registra error e propaga quando o Asaas falha', async () => {
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: false,
    });
    m.cancelAtPeriodEnd.mockRejectedValue(new Error('asaas 500'));

    await expect(cancelOwnSubscription('user-1')).rejects.toThrow('asaas 500');

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancel',
        result: 'error',
        subscriptionId: 'sub-own',
      })
    );
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe('reactivateOwnSubscription', () => {
  it('reativa no Asaas com nextDueDate no fim do período pago e limpa flags', async () => {
    const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: true,
      status: 'active',
      currentPeriodEnd: periodEnd,
    });

    expect(await reactivateOwnSubscription('user-1')).toBe('ok');

    expect(m.reactivateSubscription).toHaveBeenCalledWith(
      'asaas_own',
      periodEnd.toISOString().slice(0, 10)
    );
    expect(m.updateSet).toHaveBeenCalledWith({ cancelAtPeriodEnd: false, canceledAt: null });
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-own']);
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate', result: 'ok' })
    );
  });

  it('usa a data de hoje quando o período já venceu', async () => {
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: true,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 1000),
    });

    await reactivateOwnSubscription('user-1');

    expect(m.reactivateSubscription).toHaveBeenCalledWith(
      'asaas_own',
      new Date().toISOString().slice(0, 10)
    );
  });

  it('não chama o Asaas sem assinatura local', async () => {
    m.subsFindFirst.mockResolvedValue(null);

    expect(await reactivateOwnSubscription('user-1')).toBe('no_subscription');

    expect(m.reactivateSubscription).not.toHaveBeenCalled();
    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reactivate', result: 'no_subscription' })
    );
  });

  it.each(['canceled', 'expired'])(
    'I3: não chama o Asaas quando status local é %s',
    async (status) => {
      m.subsFindFirst.mockResolvedValue({
        id: 'sub-own',
        asaasSubscriptionId: 'asaas_own',
        cancelAtPeriodEnd: true,
        status,
        currentPeriodEnd: null,
      });

      expect(await reactivateOwnSubscription('user-1')).toBe('no_subscription');

      expect(m.reactivateSubscription).not.toHaveBeenCalled();
      expect(m.update).not.toHaveBeenCalled();
      expect(m.insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reactivate',
          result: 'no_subscription',
          subscriptionId: 'sub-own',
        })
      );
    }
  );

  it('I2: registra error e propaga quando o Asaas falha na reativação', async () => {
    m.subsFindFirst.mockResolvedValue({
      id: 'sub-own',
      asaasSubscriptionId: 'asaas_own',
      cancelAtPeriodEnd: true,
      status: 'active',
      currentPeriodEnd: null,
    });
    m.reactivateSubscription.mockRejectedValue(new Error('asaas 500'));

    await expect(reactivateOwnSubscription('user-1')).rejects.toThrow('asaas 500');

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reactivate',
        result: 'error',
        subscriptionId: 'sub-own',
      })
    );
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe('nextDueDateFor', () => {
  const now = new Date('2026-09-14T12:00:00Z');

  it('formata YYYY-MM-DD', () => {
    expect(nextDueDateFor(new Date('2026-10-01T00:00:00Z'), now)).toBe('2026-10-01');
  });

  it('usa now quando o período já passou ou é nulo', () => {
    expect(nextDueDateFor(new Date('2026-01-01T00:00:00Z'), now)).toBe('2026-09-14');
    expect(nextDueDateFor(null, now)).toBe('2026-09-14');
  });
});
