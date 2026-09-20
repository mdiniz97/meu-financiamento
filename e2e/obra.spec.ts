import { DB_URL } from './helpers/db';
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
    `psql "${DB_URL}" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const response = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
}

test('página de juros de obra mostra disclaimers e calcula sem custo', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/comprar-na-planta');

  await expect(page.getByRole('heading', { name: 'Comprar na planta' })).toBeVisible();
  await expect(page.getByText(/Esta é uma simulação/i)).toBeVisible();

  const calcular = page.getByRole('button', { name: /calcular juros de obra/i });
  await expect(calcular).not.toContainText('-1');
  await calcular.click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await expect(page.getByText('Total de juros de obra', { exact: true })).toBeVisible();
  await expect(page.getByText('Primeira parcela após entrega (PRICE 360m)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /nova simulação/i })).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/Juros de obra/).first()).toBeVisible();
});

test('portabilidade calculada aparece em minhas simulações', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  const uid = execSync(
    `psql "${DB_URL}" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  await page.request.get(`/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`);
  await page.goto('/portabilidade');
  await page.getByRole('button', { name: 'Comparar contrato atual e proposta' }).click();
  await expect(page.getByText(/vale a pena|não vale a pena/i).first()).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText('Portabilidade', { exact: true }).first()).toBeVisible();
});

test('sem plano vê card de upgrade sem acesso à ferramenta', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page);
  await page.goto('/comprar-na-planta');

  await expect(page.getByRole('heading', { name: 'Comprar na planta' })).toBeVisible();
  await expect(page.getByText('Recurso exclusivo do plano Ilimitado')).toBeVisible();
  await expect(page.getByText(/Simule juros de obra/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /ver opções de acesso/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /calcular juros de obra/i })).not.toBeVisible();
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
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/comprar-na-planta');

  await page.getByRole('switch', { name: /financiei a entrada/i }).click();
  await expect(page.getByRole('textbox', { name: 'Entrada à vista (R$)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Valor da entrada parcelado (R$)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Quantidade de parcelas' })).toHaveValue('24');
  await expect(page.getByText('Tem juros?', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Entrada à vista (R$)' }).fill('5000000');
  await page.getByRole('textbox', { name: 'Valor da entrada parcelado (R$)' }).fill('5000000');
  await page.getByRole('radio', { name: 'Sim', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Taxa da entrada (%)' })).toBeVisible();

  await page.getByRole('button', { name: /calcular juros de obra/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
  await expect(page.getByText('Total pago na entrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Primeira parcela após entrega (SAC 360m)', { exact: true })).toBeVisible();
});

test('modo sei o valor da parcela aceita parte à vista e calcula', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page);
  await assinar(page, email);
  await page.goto('/comprar-na-planta');

  await page.getByRole('switch', { name: /financiei a entrada/i }).click();
  await page.getByRole('radio', { name: /sei o valor da parcela/i }).click();
  await expect(page.getByRole('textbox', { name: 'Entrada à vista (R$)' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Valor da parcela da entrada (R$)' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Entrada à vista (R$)' }).fill('5000000');
  await page.getByRole('textbox', { name: 'Valor da parcela da entrada (R$)' }).fill('450000');
  await page.getByRole('button', { name: /calcular juros de obra/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado da simulação' })).toBeVisible();
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
