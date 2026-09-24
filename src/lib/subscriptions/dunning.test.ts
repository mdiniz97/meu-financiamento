import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findManySubs: vi.fn(),
  findFirstPayment: vi.fn(),
  findFirstUser: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  cancelAtPeriodEnd: vi.fn(),
  isEmailEnabled: vi.fn(),
  sendEmail: vi.fn(),
  dunningReminderEmail: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      subscriptions: { findMany: mocks.findManySubs },
      payments: { findFirst: mocks.findFirstPayment },
      users: { findFirst: mocks.findFirstUser },
    },
    update: mocks.update,
  },
  schema: {
    subscriptions: { id: 'id', status: 'status', userId: 'user_id' },
    payments: {},
    users: { id: 'id' },
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
}));
vi.mock('@/lib/payments/asaas/subscription', () => ({
  cancelAtPeriodEnd: mocks.cancelAtPeriodEnd,
}));
vi.mock('@/lib/email/config', () => ({ isEmailEnabled: mocks.isEmailEnabled }));
vi.mock('@/lib/email/client', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/email/templates', () => ({ dunningReminderEmail: mocks.dunningReminderEmail }));

import { runDunning } from './dunning';

const now = new Date('2026-09-13T12:00:00Z');
const PAST = new Date('2026-09-13T11:00:00Z');
const FUTURE = new Date('2026-09-14T12:00:00Z');

const GRACE_SUB = {
  id: 'sub-1',
  userId: 'user-1',
  status: 'past_due',
  graceUntil: FUTURE,
  asaasSubscriptionId: 'asaas_1',
  dunningRemindedAt: null,
};

beforeEach(() => {
  mocks.findManySubs.mockReset();
  mocks.findFirstPayment.mockReset().mockResolvedValue(null);
  mocks.findFirstUser.mockReset().mockResolvedValue({ id: 'user-1', name: 'Maria', email: 'm@e.com' });
  mocks.set.mockReset().mockReturnValue({ where: mocks.where });
  mocks.where.mockReset().mockResolvedValue([]);
  mocks.update.mockReset().mockReturnValue({ set: mocks.set });
  mocks.cancelAtPeriodEnd.mockReset().mockResolvedValue(undefined);
  mocks.isEmailEnabled.mockReset().mockReturnValue(false);
  mocks.sendEmail.mockReset().mockResolvedValue({ id: 'email_1' });
  mocks.dunningReminderEmail
    .mockReset()
    .mockReturnValue({ subject: 'S', html: '<p>h</p>', text: 't' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('runDunning', () => {
  it('suspende carência vencida, marca canceled e inativa no Asaas', async () => {
    mocks.findManySubs.mockResolvedValue([
      {
        id: 'sub-1',
        status: 'past_due',
        graceUntil: PAST,
        asaasSubscriptionId: 'asaas_1',
      },
    ]);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 0, suspended: 1, emailed: 0 });
    expect(mocks.set).toHaveBeenCalledWith({ status: 'canceled', canceledAt: now });
    expect(mocks.cancelAtPeriodEnd).toHaveBeenCalledWith('asaas_1');
  });

  it('suspende sem asaasSubscriptionId e não chama a API', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: PAST, asaasSubscriptionId: null },
    ]);

    const out = await runDunning(now);

    expect(out.suspended).toBe(1);
    expect(mocks.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('erro da API não impede a suspensão local', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: PAST, asaasSubscriptionId: 'asaas_1' },
    ]);
    mocks.cancelAtPeriodEnd.mockRejectedValue(new Error('Asaas API 500'));

    const out = await runDunning(now);

    expect(out.suspended).toBe(1);
    expect(mocks.set).toHaveBeenCalledWith({ status: 'canceled', canceledAt: now });
  });

  it('dentro da carência lembra com invoiceUrl e não atualiza', async () => {
    mocks.findManySubs.mockResolvedValue([GRACE_SUB]);
    mocks.findFirstPayment.mockResolvedValue({ invoiceUrl: 'https://asaas.com/i/sub-1' });

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0, emailed: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('https://asaas.com/i/sub-1')
    );
  });

  it('ignora past_due sem graceUntil', async () => {
    mocks.findManySubs.mockResolvedValue([
      { id: 'sub-1', status: 'past_due', graceUntil: null, asaasSubscriptionId: 'asaas_1' },
    ]);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 0, suspended: 0, emailed: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('envia e-mail, marca dunningRemindedAt e conta emailed', async () => {
    mocks.findManySubs.mockResolvedValue([GRACE_SUB]);
    mocks.isEmailEnabled.mockReturnValue(true);
    mocks.findFirstPayment.mockResolvedValue({
      invoiceUrl: 'https://asaas.com/i/1',
      valueCents: 4900,
      dueDate: new Date('2026-09-10T00:00:00Z'),
    });

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0, emailed: 1 });
    expect(mocks.dunningReminderEmail).toHaveBeenCalledWith({
      name: 'Maria',
      valueCents: 4900,
      dueDate: new Date('2026-09-10T00:00:00Z'),
      invoiceUrl: 'https://asaas.com/i/1',
      graceUntil: FUTURE,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: 'm@e.com',
      subject: 'S',
      html: '<p>h</p>',
      text: 't',
    });
    expect(mocks.set).toHaveBeenCalledWith({ dunningRemindedAt: now });
  });

  it('NÃO reenvia se já lembrou nesta carência', async () => {
    mocks.findManySubs.mockResolvedValue([
      { ...GRACE_SUB, dunningRemindedAt: new Date('2026-09-13T06:00:00Z') },
    ]);
    mocks.isEmailEnabled.mockReturnValue(true);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0, emailed: 0 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('sem e-mail habilitado não envia nem marca', async () => {
    mocks.findManySubs.mockResolvedValue([GRACE_SUB]);

    const out = await runDunning(now);

    expect(out.emailed).toBe(0);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('falha no envio não derruba o job nem marca como lembrado', async () => {
    mocks.findManySubs.mockResolvedValue([GRACE_SUB]);
    mocks.isEmailEnabled.mockReturnValue(true);
    mocks.sendEmail.mockRejectedValue(new Error('Resend 500'));

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0, emailed: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[dunning] falha ao enviar lembrete'),
      expect.anything()
    );
  });

  it('usuário sem e-mail não quebra', async () => {
    mocks.findManySubs.mockResolvedValue([GRACE_SUB]);
    mocks.isEmailEnabled.mockReturnValue(true);
    mocks.findFirstUser.mockResolvedValue(null);

    const out = await runDunning(now);

    expect(out).toEqual({ reminded: 1, suspended: 0, emailed: 0 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
