import { test, expect } from '@playwright/test';

test('dev: login e cadastro mostram botão Google e login por email', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /entrar com google/i })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Senha')).toBeVisible();

  await page.goto('/cadastro');
  await expect(page.getByRole('button', { name: /criar conta com google/i })).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
