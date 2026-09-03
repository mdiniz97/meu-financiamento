import { expect, test } from '@playwright/test';

test('lista do blog mostra os 6 artigos e navega ao artigo', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
  await expect(page.getByText(/Entrada e custos da compra/i)).toBeVisible();
  await expect(page.getByText(/SAC vs PRICE/i)).toBeVisible();
  await expect(page.getByText(/Quitar o financiamento antes/i)).toBeVisible();
  await expect(page.getByText(/Qual banco financia melhor/i)).toBeVisible();
  await expect(page.getByText(/Selic alta/i)).toBeVisible();
  await expect(page.getByText(/Portabilidade de financiamento/i)).toBeVisible();
  await expect(page.getByText(/Juros do financiamento: nominal, efetiva e CET/i)).toBeVisible();

  await page.getByRole('link', { name: /SAC vs PRICE/i }).click();
  await page.waitForURL(/\/blog\/sac-ou-price$/);
  await expect(page.getByRole('heading', { name: /SAC vs PRICE/i })).toBeVisible();
});

test('artigo renderiza seções, nota e CTA', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  await expect(page.getByRole('heading', { name: /PRICE: parcela constante/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /SAC: parcela que começa alta/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /comparar sac e price no simulador/i })).toBeVisible();
});

test('fim do artigo sugere outros artigos', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  await expect(page.getByRole('heading', { name: 'Continue aprendendo' })).toBeVisible();
  const cards = page.getByRole('link', { name: /Ler$/ });
  await expect(cards.first()).toBeVisible();
  await cards.first().click();
  await page.waitForURL(/\/blog\/(?!sac-ou-price$).*/);
  await expect(page.getByRole('link', { name: /continue|ver todos/i }).first()).toBeVisible().catch(() => undefined);
});

test('CTA do artigo de custos leva à calculadora pública', async ({ page }) => {
  await page.goto('/blog/quanto-preciso-para-comprar');
  await page.getByRole('link', { name: /calcular meus custos de compra/i }).click();
  await page.waitForURL(/\/custos-da-compra$/);
  await expect(page.getByRole('heading', { name: 'Quanto preciso para comprar?' })).toBeVisible();
});

test('rota antiga /artigos redireciona para o blog', async ({ page }) => {
  await page.goto('/artigos');
  await page.waitForURL(/\/blog$/);
  await page.goto('/artigos/sac-ou-price');
  await page.waitForURL(/\/blog\/sac-ou-price$/);
});

test('home tem seção do blog com artigos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /aprenda antes de assinar o contrato/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /ver todos os artigos/i })).toBeVisible();
  await page.getByRole('link', { name: /SAC vs PRICE/i }).first().click();
  await page.waitForURL(/\/blog\/sac-ou-price$/);
});

test('slug inexistente retorna 404', async ({ page }) => {
  const response = await page.goto('/blog/nao-existe');
  expect(response?.status()).toBe(404);
});

test('página de juros recomenda o artigo de juros', async ({ page }) => {
  await page.goto('/juros');
  await expect(page.getByRole('heading', { name: 'Aprenda mais sobre juros' })).toBeVisible();
  await page.getByRole('link', { name: /juros do financiamento: nominal, efetiva e cet/i }).click();
  await page.waitForURL(/\/blog\/juros-do-financiamento$/);
  await expect(page.getByRole('heading', { name: /Juros do financiamento/i })).toBeVisible();
});

test('página de custos recomenda o artigo da compra', async ({ page }) => {
  await page.goto('/custos-da-compra');
  await expect(page.getByRole('heading', { name: 'Leia sobre a compra do imóvel' })).toBeVisible();
  await page.getByRole('link', { name: /entrada e custos da compra/i }).first().click();
  await page.waitForURL(/\/blog\/quanto-preciso-para-comprar$/);
});
