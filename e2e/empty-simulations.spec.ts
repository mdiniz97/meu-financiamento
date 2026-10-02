import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(url?.hostname !== 'localhost' || url.pathname !== '/financiamento_trial_test', 'isolated database required');

test('new calculators open without example values', async ({ page }) => {
  const email = `empty-forms-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({ name: 'Teste', email, passwordHash: await bcrypt.hash('senhaTeste123', 10) }).returning();
  await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  await db.insert(schema.subscriptions).values({ userId: user.id, provider: 'fake', packId: 'unlimited', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) });
  try {
    await page.goto('/?login=1');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Senha').fill('senhaTeste123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/nova-simulacao/);
    for (const path of ['/nova-simulacao', '/amortizador-inteligente', '/qual-imovel-cabe-no-meu-bolso', '/portabilidade', '/meta-de-quitacao', '/investir-ou-amortizar', '/alugar-ou-comprar', '/consorcio-vale-a-pena', '/comprar-na-planta', '/custos-da-compra', '/comparar-propostas']) {
      await page.goto(path);
      const inputs = page.locator('input:not([aria-hidden="true"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="range"])');
      expect(await inputs.count(), path).toBeGreaterThan(0);
      for (const input of await inputs.all()) {
        if (await input.isVisible()) await expect(input, `${path}: ${await input.getAttribute('id')}`).toHaveValue('');
      }
    }
    await page.goto('/nova-simulacao');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Informe o valor financiado' })).toBeVisible();
    await page.locator('#principal').fill('35000000');
    await page.locator('#annualRate').fill('10.5');
    await page.locator('#months').fill('240');
    await page.locator('#trMonthly').fill('0');
    await page.locator('#trMonthly').blur();
    await expect(page.locator('#trMonthly')).toHaveValue('0');
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect(page).toHaveURL(/\/simulacao/);
    await expect.poll(async () => Boolean(await db.query.simulations.findFirst({ where: eq(schema.simulations.userId, user.id) }))).toBe(true);
    const saved = await db.query.simulations.findFirst({ where: eq(schema.simulations.userId, user.id) });
    expect(saved).toBeDefined();
    const payload = saved!.payload as { input: { principal: number; months: number; trMonthly: number; insuranceMonthly: number } };
    expect(payload.input).toMatchObject({ principal: 350000, months: 240, trMonthly: 0, insuranceMonthly: 0 });
    await page.goto(`/simulacao?id=${saved!.id}`);
    await expect(page.getByText('Análise do financiamento', { exact: true }).first()).toBeVisible();
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});
