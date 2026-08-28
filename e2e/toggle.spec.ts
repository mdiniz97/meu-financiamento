import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('switch comparar PRICE ↔ SAC liga a comparação lado a lado', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local (conceder plano via webhook fake com userId real)');
  const email = `t${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);

  const uid = execSync(`psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`).toString().trim();
  const res = await page.request.get(`http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`);
  expect(res.ok()).toBeTruthy();

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('switch').first().click();
  await expect(page.locator('#comparacao-sistemas')).toBeVisible();
  await expect(page.locator('#comparacao-sistemas').getByText(/PRICE/).first()).toBeVisible();
  await expect(page.locator('#comparacao-sistemas').getByText(/SAC/).first()).toBeVisible();
});
