import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}
const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(target?.hostname !== 'localhost' || target.pathname !== '/financiamento_trial_test', 'requires isolated local PostgreSQL');

for (const cycle of ['MONTHLY', 'YEARLY'] as const) {
  test(`explicit ${cycle} purchase preserves selected cycle, price and access`, async ({ page }) => {
    const email = `cycles-${crypto.randomUUID()}@example.test`;
    try {
      await page.goto('/?signup=1');
      await page.getByRole('textbox', { name: 'Nome' }).fill('Teste Ciclos');
      await page.getByRole('textbox', { name: 'Email' }).fill(email);
      await page.getByLabel('Senha').fill('senhaTeste123');
      await page.getByRole('button', { name: 'Criar conta e ganhar 10 créditos' }).click();
      await expect(page).toHaveURL(/nova-simulacao/);
      await page.getByRole('dialog', { name: /7 dias do Ilimitado/ }).getByRole('button', { name: 'Agora não' }).click();
      await page.goto(`/assinar?cycle=${cycle}`);
      const monthly = cycle === 'MONTHLY';
      await expect(page).toHaveURL(/\/perfil$/, { timeout: 30000 });
      await page.goto('/assinatura');
      await expect(page.getByText(monthly ? 'Assinatura mensal' : 'Assinatura anual', { exact: true })).toBeVisible();
      await expect(page.getByText(monthly ? 'R$ 18,90/mês' : 'R$ 119,90/ano', { exact: true })).toBeVisible();
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      const rows = await db.query.subscriptions.findMany({ where: eq(schema.subscriptions.userId, user!.id) });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ cycle, status: 'active', contractedPriceCents: monthly ? 1890 : 11990 });
      const days = (rows[0].currentPeriodEnd!.getTime() - Date.now()) / 86400000;
      expect(days).toBeGreaterThan(monthly ? 27 : 364);
      expect(days).toBeLessThan(monthly ? 32 : 366);
      await page.goto(`/assinar?cycle=${monthly ? 'YEARLY' : 'MONTHLY'}`);
      await expect(page).toHaveURL(/\/perfil$/);
      expect(await db.query.subscriptions.findMany({ where: eq(schema.subscriptions.userId, user!.id) })).toHaveLength(1);
    } finally {
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (user) await db.delete(schema.users).where(eq(schema.users.id, user.id));
    }
  });
}
