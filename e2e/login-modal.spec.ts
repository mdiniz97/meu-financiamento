import { test, expect } from '@playwright/test';

test.describe('login como modal', () => {
  test('/login encaminha para a home com o modal aberto', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/\?login=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('botão do header abre o modal sobre a página atual', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /fazer login/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/login=1/);
  });

  test('?login=1 abre o modal direto no carregamento', async ({ page }) => {
    await page.goto('/?login=1');

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Esc fecha e limpa o parâmetro da URL', async ({ page }) => {
    await page.goto('/?login=1');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).not.toHaveURL(/login=1/);
  });

  test('página protegida sem sessão cai na home com o modal aberto', async ({ page }) => {
    await page.goto('/minhas-simulacoes');

    await expect(page).toHaveURL(/\/\?login=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
