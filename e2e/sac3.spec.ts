import { test } from '@playwright/test';

test('toggle sac detalhado', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);
  await page.getByText('Pagar como no SAC').scrollIntoViewIfNeeded();
  const quita1 = await page.getByText('Quitação').first().locator('..').textContent();
  console.log('quita antes:', JSON.stringify(quita1));
  const sw = page.locator('[data-slot="switch"]').last();
  await sw.click();
  await page.waitForTimeout(800);
  const quita2 = await page.getByText('Quitação').first().locator('..').textContent();
  console.log('quita depois:', JSON.stringify(quita2));
  const juros = await page.getByText('Juros totais').first().locator('..').textContent();
  console.log('juros:', JSON.stringify(juros));
  const economia = await page.getByText(/Economia total|Custo adicional/).first().locator('..').textContent();
  console.log('economia:', JSON.stringify(economia));
});
