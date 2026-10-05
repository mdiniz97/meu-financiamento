import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(url?.hostname !== 'localhost' || url.pathname !== '/financiamento_trial_test', 'isolated database required');

async function fillNegotiation(page: import('@playwright/test').Page, teto: string) {
  await page.goto('/negociacao');
  await page.locator('#ngPrincipal').fill('30000000');
  await page.locator('#ngProperty').fill('40000000');
  await page.locator('#ngRate').fill('10');
  await page.locator('#ngMonths').fill('360');
  await page.locator('#ngTeto').fill(teto);
  await page.locator('#ngBank').click();
  await page.getByRole('option', { name: 'Caixa', exact: true }).click();
}

test('mesa de negociação é pública e mostra veredito sem login', async ({ page }) => {
  await fillNegotiation(page, '300000');
  await expect(page.getByText(/Cabe no seu orçamento|Cabe, mas fica apertado/)).toBeVisible();
  await expect(page.getByText('Entre para salvar')).toBeVisible();
});

test('mesa de negociação: teto que não cabe', async ({ page }) => {
  await fillNegotiation(page, '100000');
  await expect(page.getByText('Não cabe com esse valor por mês')).toBeVisible();
});

test('campo de meses não mantém zero à esquerda', async ({ page }) => {
  await page.goto('/negociacao');
  const months = page.locator('#ngMonths');
  await months.click();
  await months.press('3');
  await expect(months).toHaveValue('3');
});

test('mesa de negociação: logado salva a oferta', async ({ page }) => {
  const email = `nego-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({ name: 'T', email, passwordHash: await bcrypt.hash('senhaTeste123', 10) }).returning();
  await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  await db.insert(schema.subscriptions).values({ userId: user.id, provider: 'fake', packId: 'unlimited', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) });
  try {
    await page.goto('/?login=1');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Senha').fill('senhaTeste123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/nova-simulacao/);
    await fillNegotiation(page, '300000');
    await page.getByRole('button', { name: 'Salvar oferta' }).click();
    await expect(page.getByText('Oferta salva.')).toBeVisible();
    await expect(page.getByText('Ofertas salvas')).toBeVisible();
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});
