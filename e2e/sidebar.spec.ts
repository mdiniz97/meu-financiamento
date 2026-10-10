import { seedCalculatorExample } from './helpers/calculator-example';
import { test, expect } from '@playwright/test';

async function cadastrar(page: import('@playwright/test').Page) {
  const email = `menu${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste Menu');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 10 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  await seedCalculatorExample(page);
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

test('desktop keeps logout in viewport when navigation is taller than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await cadastrar(page);
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeInViewport();
  await page.getByRole('link', { name: 'Indique amigos', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: 'Indique amigos', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeInViewport();
});
