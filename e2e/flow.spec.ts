import { expect, test } from '@playwright/test';

test('cadastro → simular → comprar créditos', async ({ page }) => {
  const email = `user${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await expect(page).toHaveURL(/nova-simulacao/);

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/total pago/i).first()).toBeVisible();

  await page.goto('/planos');
  await page.getByRole('button', { name: /10 créditos/i }).click();
  await expect(page).toHaveURL(/webhooks\/payments/);
  await page.goto('/planos');
  await expect(page.getByText(/saldo de créditos: 12/i)).toBeVisible();
});

test('gate ilimitado: PDF bloqueado sem assinatura', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste2');
  await page.getByLabel('Email').fill(`u${Date.now()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/exclusivo/i).first()).toBeVisible();
});
