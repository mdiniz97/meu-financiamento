import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  auth: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
  subsFindFirst: vi.fn(),
  updateWhere: vi.fn(),
  updateSet: vi.fn(),
  update: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidatePath }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  cancelAtPeriodEnd: m.cancelAtPeriodEnd,
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
}));
vi.mock('@/db', () => ({
  db: {
    query: { subscriptions: { findFirst: m.subsFindFirst } },
    update: m.update,
  },
  schema: {
    subscriptions: {
      id: 'subscriptions.id',
      userId: 'subscriptions.user_id',
      packId: 'subscriptions.pack_id',
      provider: 'subscriptions.provider',
      status: 'subscriptions.status',
    },
  },
}));

import { cancelSubscription } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockImplementation(() => ({ set: m.updateSet }));
  m.updateSet.mockImplementation(() => ({ where: m.updateWhere }));
  m.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  m.auth.mockResolvedValue({ userId: 'user-1' });
  m.subsFindFirst.mockResolvedValue({
    id: 'sub-local-1',
    asaasSubscriptionId: 'sub_asaas_1',
  });
  m.cancelAtPeriodEnd.mockResolvedValue(undefined);
});

describe('cancelSubscription', () => {
  it('cancela no Asaas e marca cancel_at_period_end mantendo status active', async () => {
    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).toHaveBeenCalledWith('sub_asaas_1');
    expect(m.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true })
    );
    const arg = m.updateSet.mock.calls[0][0] as { canceledAt: unknown };
    expect(arg.canceledAt).toBeInstanceOf(Date);
    expect(m.updateSet.mock.calls[0][0]).not.toHaveProperty('status');
    expect(m.updateWhere).toHaveBeenCalledWith(['subscriptions.id', 'sub-local-1']);
    expect(m.revalidatePath).toHaveBeenCalledWith('/perfil');
  });

  it('marca localmente mesmo sem asaasSubscriptionId (sem chamar Asaas)', async () => {
    m.subsFindFirst.mockResolvedValue({ id: 'sub-local-2', asaasSubscriptionId: null });

    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: true })
    );
  });

  it('não faz nada quando não há assinatura ativa do usuário', async () => {
    m.subsFindFirst.mockResolvedValue(null);

    await cancelSubscription();

    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });

  it('manda para o login quando não autenticado', async () => {
    m.auth.mockResolvedValue(null);

    await expect(cancelSubscription()).rejects.toThrow(
      'REDIRECT:/login?callbackUrl=/perfil'
    );
    expect(m.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });
});
