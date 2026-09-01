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
  const email = `obra-${Date.now()}@teste.com`;
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

test('página de juros de obra mostra disclaimers e calcula com 1 crédito', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page);
  await page.goto('/comprar-na-planta');

  await expect(page.getByRole('heading', { name: 'Comprar na planta' })).toBeVisible();
  await expect(page.getByText(/Esta é uma simulação/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /calcular juros de obra/i })).toContainText('-1');

  await page.getByRole('button', { name: /calcular juros de obra/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await expect(page.getByText('Total de juros de obra', { exact: true })).toBeVisible();
  await expect(page.getByText('Primeira parcela após entrega (PRICE 360m)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /nova simulação/i })).toBeVisible();

  await page.goto('/perfil');
  await expect(page.getByText('Saldo de créditos').locator('..').getByText('1', { exact: true })).toBeVisible();
});

test('sem créditos abre o modal de upgrade', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page);
  await page.goto('/comprar-na-planta');

  const calcular = page.getByRole('button', { name: /calcular juros de obra/i });
  await calcular.click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await page.getByRole('button', { name: /nova simulação/i }).click();
  await calcular.click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await page.getByRole('button', { name: /nova simulação/i }).click();
  await calcular.click();
  await expect(page.getByRole('dialog')).toContainText('Recurso exclusivo do plano Ilimitado');
  await expect(page.getByRole('dialog')).toContainText('5 créditos');
});

test('Ilimitado calcula sem custo e sem chip', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/comprar-na-planta');

  const calcular = page.getByRole('button', { name: /calcular juros de obra/i });
  await expect(calcular).not.toContainText('-1');
  await calcular.click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
});

test('toggle Financiei a entrada abre campos e inclui a entrada no resultado', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page);
  await page.goto('/comprar-na-planta');

  await page.getByRole('switch', { name: /financiei a entrada/i }).click();
  await expect(page.getByRole('textbox', { name: 'Valor da entrada parcelado (R$)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Quantidade de parcelas' })).toHaveValue('24');
  await expect(page.getByText('Tem juros?', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Valor da entrada parcelado (R$)' }).fill('10000000');
  await page.getByRole('radio', { name: 'Sim', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Taxa da entrada (%)' })).toBeVisible();

  await page.getByRole('button', { name: /calcular juros de obra/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await expect(page.getByText('Total pago na entrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Primeira parcela após entrega (SAC 360m)', { exact: true })).toBeVisible();
});

test('landing tem seção educativa de comprar na planta com CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /como funciona comprar na planta/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /calcular meus juros de obra/i })).toBeVisible();
});

test('sidebar tem link Comprar na Planta', async ({ page }) => {
  await cadastrar(page);
  await page.getByRole('link', { name: 'Comprar na Planta', exact: true }).click();
  await page.waitForURL(/\/comprar-na-planta$/);
  await expect(page.getByRole('heading', { name: 'Comprar na planta' })).toBeVisible();
});
