import { execSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function cadastrar(page: Page, prefix: string) {
  const email = `${prefix}${Date.now()}@teste.com`;
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
  )
    .toString()
    .trim();
  const res = await page.request.get(
    `http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(res.ok()).toBeTruthy();
}

async function preencherProposta(page: Page, index: number, bank: string, entradaCents: string) {
  await page.getByLabel(/Banco/).nth(index).fill(bank);
  await page.getByLabel(/Imóvel \(R\$\)/).nth(index).fill('85000000');
  await page.getByLabel(/Entrada \(R\$\)/).nth(index).fill(entradaCents);
  if (index === 0) await page.getByLabel(/Taxa a\.a\. \(%\)/).first().fill('9,7');
  if (index === 0) await page.getByLabel(/CET informado a\.a\. \(%\)/).first().fill('10,42');
  if (index === 1) await page.getByLabel(/Taxa a\.a\. \(%\)/).nth(1).fill('9,2');
  if (index === 1) await page.getByLabel(/CET informado a\.a\. \(%\)/).nth(1).fill('11,6');
  if (index === 2) await page.getByLabel(/Taxa a\.a\. \(%\)/).nth(2).fill('9,45');
  if (index === 2) await page.getByLabel(/CET informado a\.a\. \(%\)/).nth(2).fill('10,31');
}

test('não assinante vê bloqueio com upgrade', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page, 'b');
  await page.goto('/comparar-propostas');
  await expect(page.getByText(/recurso exclusivo do plano ilimitado/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /ver opções de acesso/i })).toBeVisible();
});

test('ilimitado compara 2 propostas, adiciona 3ª, vê ranking + alerta CET, salva, PDF e leva ao simulador', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'c');
  await assinar(page, email);
  await page.goto('/comparar-propostas');

  await page.getByLabel(/Quanto consegue pagar por mês \(R\$\)/).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await expect(page.getByLabel(/Banco/)).toHaveCount(3);
  await preencherProposta(page, 2, 'Santander', '27000000');

  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
  await expect(page.getByText(/custo total da aquisição/i)).toBeVisible();
  await expect(page.getByText(/alerta de cet/i)).toBeVisible();
  await expect(page.getByText(/meses com aporte de/i).first()).toBeVisible();

  await page.getByRole('button', { name: /salvar comparação/i }).click();
  await expect(page.getByText(/comparações salvas/i)).toBeVisible();
  await expect(page.getByText(/caixa vs itaú/i)).toBeVisible();

  const pdfResponse = page.waitForResponse((r) => r.url().includes('/api/pdf/comparison'));
  await page.getByRole('button', { name: /gerar pdf/i }).click();
  expect((await pdfResponse).status()).toBe(200);

  await page.getByRole('button', { name: /levar ao simulador/i }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});
