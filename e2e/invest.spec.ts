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

async function cadastrar(page: Page) {
  const email = `invest-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  return email;
}

async function assinar(page: Page, email: string) {
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const response = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
}

test('página investir ou amortizar calcula sem custo e mostra veredito', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/investir-ou-amortizar');

  await expect(page.getByRole('heading', { name: 'Investir ou amortizar?' })).toBeVisible();

  const comparar = page.getByRole('button', { name: /comparar/i });
  await expect(comparar).not.toContainText('-1');
  await comparar.click();
  await expect(page.getByRole('heading', { name: 'Resultado da comparação' })).toBeVisible();
  await expect(page.getByText(/maior economia de juros/i).first()).toBeVisible();
  await expect(page.getByText(/reduzir a parcela/i).first()).toBeVisible();
  await expect(page.getByText(/reduzir o prazo/i).first()).toBeVisible();
  await expect(page.getByText(/investir e amortizar com o rendimento/i).first()).toBeVisible();
});

test('Ilimitado calcula sem custo e sem chip', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/investir-ou-amortizar');

  const comparar = page.getByRole('button', { name: /comparar/i });
  await expect(comparar).not.toContainText('-1');
  await comparar.click();
  await expect(page.getByRole('heading', { name: 'Resultado da comparação' })).toBeVisible();
});

test('seção planta ou investir calcula junto sem custo extra', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/comprar-na-planta');

  await page.getByRole('button', { name: /calcular juros de obra/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Planta ou investir?' })).toBeVisible();
  await expect(page.getByText(/vale investir até a entrega|comprar na planta pesa menos/i)).toBeVisible();
  await expect(page.getByText(/na entrega você tem/i).first()).toBeVisible();
});

test('landing tem seção investir ou amortizar com CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /com R\$ 100 mil, vale investir ou amortizar/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /comparar meu caso/i })).toBeVisible();
});

test('sidebar tem link Investir ou Amortizar', async ({ page }) => {
  await cadastrar(page);
  await page.getByRole('link', { name: 'Investir ou Amortizar', exact: true }).click();
  await page.waitForURL(/\/investir-ou-amortizar$/);
  await expect(page.getByRole('heading', { name: 'Investir ou amortizar?' })).toBeVisible();
});
