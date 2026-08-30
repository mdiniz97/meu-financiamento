import { test, expect } from '@playwright/test';

async function cadastrar(page: import('@playwright/test').Page) {
  const email = `menu${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste Menu');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('mobile usa conteúdo em largura total e drawer fecha no X', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await cadastrar(page);

  const main = page.locator('main');
  await expect(main).toBeVisible();
  const box = await main.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(390);

  await page.getByRole('button', { name: /abrir menu/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /fechar menu/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
