import { test, expect } from '@playwright/test';

test.describe('login e cadastro como modal', () => {
  test('/login encaminha para a home com o modal de entrar', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/\?login=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('/cadastro encaminha para a home com o modal de criar conta', async ({ page }) => {
    await page.goto('/cadastro');

    await expect(page).toHaveURL(/\/\?signup=1/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  });

  test('botão do header abre o modal sobre a página atual', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /fazer login/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/login=1/);
  });

  test('"Criar conta grátis" abre o modal já no modo cadastro', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /criar conta grátis/i }).first().click();

    await expect(page).toHaveURL(/signup=1/);
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  });

  test('troca de modo sem fechar nem navegar', async ({ page }) => {
    await page.goto('/?login=1');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.getByRole('button', { name: 'Cadastre-se' }).click();

    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/signup=1/);
    await expect(page).not.toHaveURL(/login=1/);

    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/login=1/);
  });

  test('?signup=1 abre o modal direto no carregamento', async ({ page }) => {
    await page.goto('/?signup=1');

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  });

  test('Esc fecha e limpa os parâmetros da URL', async ({ page }) => {
    await page.goto('/?signup=1');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).not.toHaveURL(/signup=1/);
  });

  test('página protegida sem sessão cai na home com o modal e guarda o destino', async ({
    page,
  }) => {
    await page.goto('/minhas-simulacoes');

    await expect(page).toHaveURL(/\/\?login=1&next=%2Fminhas-simulacoes/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('o destino guardado sobrevive à troca de modo', async ({ page }) => {
    await page.goto('/perfil');

    await expect(page).toHaveURL(/next=%2Fperfil/);
    await page.getByRole('button', { name: 'Cadastre-se' }).click();

    await expect(page).toHaveURL(/signup=1/);
    await expect(page).toHaveURL(/next=%2Fperfil/);
  });
});
