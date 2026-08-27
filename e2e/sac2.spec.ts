import { test } from '@playwright/test';

test('toggle pagar como no SAC muda o resultado', async ({ page }) => {
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);
  await page.getByText('Pagar como no SAC').scrollIntoViewIfNeeded();
  const economia1 = await page.getByText('Economia total').locator('..').textContent().catch(() => null);
  console.log('antes:', economia1);
  const sw = page.locator('[data-slot="switch"]').last();
  const checked = await sw.getAttribute('data-checked');
  console.log('switch checked?', checked, '| count:', await page.locator('[data-slot="switch"]').count());
  if (checked === null) {
    await sw.click();
    await page.waitForTimeout(600);
  }
  const economia2 = await page.getByText('Economia total').locator('..').textContent().catch(() => null);
  console.log('depois:', economia2);
  console.log('parcela nova aparece?', await page.getByText('Parcela nova').count());
});
