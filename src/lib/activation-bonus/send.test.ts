import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: mail.sendEmail }));
import { runActivationBonus } from './send';

// Integration tests only run against explicitly opted-in local Postgres; never touch hosted databases.
const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const local = process.env.ACTIVATION_BONUS_DB_TESTS === '1' && target?.hostname === 'localhost' &&
  target.port === '5433' && target.pathname === '/financiamento_bonus_test';
describe.runIf(local)('runActivationBonus (local Postgres)', () => {
  const ids: string[] = [];
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 86_400_000);
  let serial = 0;

  beforeAll(async () => {
    await db.insert(schema.packs).values({
      id: 'unlimited', name: 'Test unlimited', priceCents: 0, isSubscription: true, credits: null,
    }).onConflictDoNothing();
  });

  async function user(ageMs: number, extra: Partial<typeof schema.users.$inferInsert> = {}) {
    const [created] = await db.insert(schema.users).values({
      name: 'Pessoa Teste', email: `bonus-test-${Date.now()}-${++serial}@example.invalid`,
      passwordHash: 'test-only', createdAt: new Date(now.getTime() - ageMs), ...extra,
    }).returning();
    ids.push(created.id);
    return created;
  }

  beforeEach(() => {
    vi.stubEnv('ACTIVATION_BONUS_START_AT', start.toISOString());
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'test@example.invalid');
    vi.stubEnv('APP_URL', 'https://amortiza.me');
    mail.sendEmail.mockReset().mockResolvedValue({ id: 'test' });
  });
  afterEach(async () => {
    if (ids.length) await db.delete(schema.users).where(inArray(schema.users.id, ids.splice(0)));
    vi.unstubAllEnvs();
  });

  it('ignora 23h59 e reserva uma só tentativa ao completar 24h', async () => {
    const younger = await user(24 * 3_600_000 - 60_000);
    const eligible = await user(24 * 3_600_000);
    const result = await runActivationBonus(now);
    expect(result.attempted).toBe(1);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].to).toBe(eligible.email);
    expect(await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, younger.id) })).toBeUndefined();
    const row = await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, eligible.id) });
    expect(row?.state).toBe('attempted');
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('seleciona variante por simulação salva, inclusive histórico', async () => {
    const noSaved = await user(5 * 86_400_000);
    const saved = await user(5 * 86_400_000);
    await db.insert(schema.simulations).values({
      userId: saved.id, name: 'Teste', payload: {}, result: {}, system: 'PRICE',
    });
    expect((await runActivationBonus(now)).attempted).toBe(2);
    const rows = await db.select().from(schema.activationBonusOffers)
      .where(inArray(schema.activationBonusOffers.userId, [noSaved.id, saved.id]));
    expect(rows.find((r) => r.userId === noSaved.id)?.variant).toBe('first_simulation');
    expect(rows.find((r) => r.userId === saved.id)?.variant).toBe('keep_exploring');
  });

  it('prioriza 20 novos e processa até 30 históricos por rodada', async () => {
    const records = await Promise.all([
      ...Array.from({ length: 21 }, () => user(24 * 3_600_000)),
      ...Array.from({ length: 31 }, () => user(5 * 86_400_000)),
    ]);
    const first = await runActivationBonus(now);
    expect(first.attempted).toBe(50);
    const rows = await db.select().from(schema.activationBonusOffers)
      .where(inArray(schema.activationBonusOffers.userId, records.map((r) => r.id)));
    expect(rows.filter((r) => records.slice(0, 21).some((u) => u.id === r.userId))).toHaveLength(20);
    expect(rows.filter((r) => records.slice(21).some((u) => u.id === r.userId))).toHaveLength(30);
    expect((await runActivationBonus(now)).attempted).toBe(2);
  });

  it('nunca registra tentativa para quem recusou ou com envio desligado', async () => {
    const opted = await user(5 * 86_400_000, { activationBonusOptOutAt: now });
    const other = await user(5 * 86_400_000);
    vi.stubEnv('EMAIL_ENABLED', 'false');
    expect((await runActivationBonus(now)).attempted).toBe(0);
    vi.stubEnv('EMAIL_ENABLED', 'true');
    expect((await runActivationBonus(now)).attempted).toBe(1);
    expect(await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, opted.id) })).toBeUndefined();
    expect(await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, other.id) })).toBeDefined();
  });

  it('falha fechado sem marco RFC3339 válido', async () => {
    await user(5 * 86_400_000);
    for (const startAt of ['', '25/09/2026', '2026-09-25', 'invalid']) {
      vi.stubEnv('ACTIVATION_BONUS_START_AT', startAt);
      expect((await runActivationBonus(now)).attempted).toBe(0);
    }
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it('dois crons e falha incerta fazem no máximo um POST por conta', async () => {
    const eligible = await user(5 * 86_400_000);
    mail.sendEmail.mockRejectedValue(new Error('unknown outcome'));
    const [a, b] = await Promise.all([runActivationBonus(now), runActivationBonus(now)]);
    expect(a.attempted + b.attempted).toBe(1);
    expect(a.failed + b.failed).toBe(1);
    expect((await runActivationBonus(new Date(now.getTime() + 3_600_000))).attempted).toBe(0);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    const row = await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, eligible.id) });
    expect(row?.state).toBe('attempted');
  });

  it('marca acesso Ilimitado ativo como exclusão permanente', async () => {
    const eligible = await user(5 * 86_400_000);
    await db.insert(schema.subscriptions).values({
      userId: eligible.id, packId: 'unlimited', provider: 'test', status: 'active',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });
    const result = await runActivationBonus(now);
    expect(result.skipped).toBe(1);
    expect(mail.sendEmail).not.toHaveBeenCalled();
    const row = await db.query.activationBonusOffers.findFirst({ where: eq(schema.activationBonusOffers.userId, eligible.id) });
    expect(row).toMatchObject({ state: 'skipped_unlimited', tokenHash: null, variant: null });
  });
});
