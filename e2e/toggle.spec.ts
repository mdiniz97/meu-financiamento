import { test, expect } from '@playwright/test';

const hasPsql = (() => {
  try {
    const { execSync } = require('node:child_process');
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('botão ver lado a lado liga a comparação e rola até ela', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local (conceder plano via webhook fake com userId real)');
  const email = `t${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await page.waitForURL(/nova-simulacao/);

  const { execSync } = await import('node:child_process');
  const uid = execSync(`psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`).toString().trim();
  const res = await page.request.get(`http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`);
  expect(res.ok()).toBeTruthy();

  await page.goto('/nova-simulacao');
  await page.getByText('SAC', { exact: true }).click();
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);
  await page.getByText('Raio X da dívida').first().waitFor();

  const btn = page.getByRole('button', { name: /ver lado a lado/i });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForTimeout(700);

  expect(await page.getByRole('switch').first().isChecked()).toBe(true);
  const section = page.locator('#comparacao-sistemas');
  await expect(section).toBeVisible();
  await expect(section).toBeInViewport();
});
