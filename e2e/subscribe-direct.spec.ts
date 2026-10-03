import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(url?.hostname !== 'localhost' || url.pathname !== '/financiamento_trial_test', 'isolated database required');

async function seedAndLogin(page: import('@playwright/test').Page) {
  const email = `subscribe-direct-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({ name: 'Teste', email, passwordHash: await bcrypt.hash('senhaTeste123', 10) }).returning();
  await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  await page.goto('/?login=1');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Senha').fill('senhaTeste123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/nova-simulacao/);
  return user;
}

test('landing CTA starts checkout directly without the /assinar page', async ({ page }) => {
  const user = await seedAndLogin(page);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Assinar mensal', exact: true }).click();
    await expect(page).toHaveURL(/\/perfil/);
    const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.userId, user.id) });
    expect(sub).toMatchObject({ provider: 'fake', status: 'active', cycle: 'MONTHLY' });
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});

test('/assinar auto-starts the checkout for the chosen cycle', async ({ page }) => {
  const user = await seedAndLogin(page);
  try {
    await page.goto('/assinar?cycle=MONTHLY');
    await expect(page).toHaveURL(/\/perfil/);
    const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.userId, user.id) });
    expect(sub).toMatchObject({ provider: 'fake', status: 'active', cycle: 'MONTHLY' });
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});

test('switching cycle replaces the open checkout instead of blocking', async ({ page }) => {
  const email = `subscribe-switch-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({ name: 'Teste', email, passwordHash: await bcrypt.hash('senhaTeste123', 10) }).returning();
  await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  await db.insert(schema.subscriptions).values({
    userId: user.id,
    provider: 'fake',
    packId: 'unlimited',
    status: 'incomplete',
    cycle: 'MONTHLY',
    asaasCheckoutId: 'chk_old',
    asaasCheckoutLink: 'https://sandbox.asaas.com/old',
    checkoutStartedAt: new Date(),
  });
  try {
    await page.goto('/?login=1');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Senha').fill('senhaTeste123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/nova-simulacao/);
    await page.goto('/assinar?cycle=YEARLY');
    await expect(page).toHaveURL(/\/perfil/);
    const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.userId, user.id) });
    expect(sub).toMatchObject({ provider: 'fake', status: 'active', cycle: 'YEARLY' });
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});
