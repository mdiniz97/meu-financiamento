import { test } from '@playwright/test';

test('selecionar tipo aplica e dropdown funciona', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);
  await page.getByText('Amortizações').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /adicionar amortização/i }).click();
  await page.waitForTimeout(400);
  const trigger = page.locator('[data-slot="select-trigger"]').first();
  await trigger.click();
  await page.waitForTimeout(400);
  const opts = page.locator('[data-slot="select-item"], [role="option"]');
  console.log('opções visíveis:', await opts.count());
  await opts.filter({ hasText: 'Recorrente' }).click();
  await page.waitForTimeout(500);
  const texto = await trigger.textContent();
  console.log('trigger agora:', JSON.stringify(texto));
  // reabre
  await trigger.click();
  await page.waitForTimeout(400);
  console.log('reabre ok:', await page.locator('[data-slot="select-item"], [role="option"]').count() > 0);
});
