import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function cadastrarEAssinar(page: Page) {
  const email = `smart-page-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);

  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const response = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
}

test('sidebar abre página exclusiva com amortizador completo e funcional', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page);

  await page.getByRole('link', { name: 'Amortizador Inteligente', exact: true }).click();
  await page.waitForURL(/\/amortizador-inteligente$/);
  await expect(page.getByRole('heading', { name: 'Amortizador Inteligente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /descobrir quanto posso financiar/i })).toBeVisible();
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
});

test('simulações mantém o mesmo amortizador inteligente completo', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page);
  await page.goto('/nova-simulacao');

  await expect(page.getByRole('heading', { name: 'Amortizador Inteligente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /descobrir quanto posso financiar/i })).toBeVisible();
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
});
