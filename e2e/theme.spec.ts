import { expect, test } from '@playwright/test';

test('toggle de tema aplica/remove .dark no <html> e não vaza para o app autenticado', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/dark/);

  await page.getByRole('button', { name: /ativar tema escuro/i }).click();
  await expect(html).toHaveClass(/dark/);

  await page.getByRole('button', { name: /ativar tema claro/i }).click();
  await expect(html).not.toHaveClass(/dark/);
});

test('elementos com borda na landing usam border-radius 0', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.border').first();
  await expect(card).toHaveCSS('border-radius', '0px');
});

test('tema escuro persiste da landing para as rotas autenticadas em (app)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const html = page.locator('html');
  await page.getByRole('button', { name: /ativar tema escuro/i }).click();
  await expect(html).toHaveClass(/dark/);

  await page.goto('/nova-simulacao');
  await expect(html).toHaveClass(/dark/);
});
