import { expect, test } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

test('landing mobile oferece menu com links públicos e fecha após navegar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menu = page.getByRole('dialog', { name: 'Menu de navegação' });
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Juros de mercado' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Fazer login' })).toBeVisible();
  await menu.getByRole('link', { name: 'Juros de mercado' }).click();
  await expect(page).toHaveURL(/\/juros$/);
  await expect(menu).toHaveCount(0);
});

test('landing mobile fecha menu no Escape e não mostra botão no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeHidden();
});

test('login no menu mobile abre modal de autenticação sem deixar gaveta aberta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu de navegação' });
  await menu.getByRole('button', { name: 'Fazer login' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('rotação para desktop fecha gaveta e libera rolagem', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});
