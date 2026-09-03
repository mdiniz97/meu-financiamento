import { expect, test, type Page } from '@playwright/test';

test('página pública calcula custos sem cadastro e sem erros', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/custos-da-compra');
  await expect(page.getByRole('heading', { name: 'Quanto preciso para comprar?' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Valor do imóvel (R$)' })).toBeVisible();

  await page.getByRole('button', { name: /calcular custos/i }).click();
  await expect(page.getByRole('heading', { name: 'Você precisa ter à vista' })).toBeVisible();
  await expect(page.getByText(/Total à vista/i)).toBeVisible();
  await expect(page.getByText('Entrada', { exact: true })).toBeVisible();
  await expect(page.getByText('ITBI', { exact: true })).toBeVisible();
  await expect(page.getByText('Escritura e registro', { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test('mudar UF muda o ITBI estimado', async ({ page }) => {
  await page.goto('/custos-da-compra');
  await page.getByRole('button', { name: /calcular custos/i }).click();
  await expect(page.getByText(/Média de 3% \(São Paulo\)/i)).toBeVisible();

  await page.getByRole('combobox', { name: 'Estado (UF)' }).click();
  await page.getByRole('option', { name: /RJ/ }).click();
  await page.getByRole('button', { name: /calcular custos/i }).click();
  await expect(page.getByText(/Média de 2% \(Rio de Janeiro\)/i)).toBeVisible();
});

test('navbar da landing tem o link da calculadora', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link', { name: /quanto preciso para comprar/i })).toBeVisible();
});

test('autenticado acessa pela sidebar dentro do app', async ({ page }) => {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(`custos-${Date.now()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);

  await page.getByRole('link', { name: /quanto preciso para comprar/i }).click();
  await page.waitForURL(/\/custos-da-compra$/);
  await expect(page.getByRole('heading', { name: 'Quanto preciso para comprar?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Simulações', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /calcular custos/i }).click();
  await expect(page.getByRole('heading', { name: 'Você precisa ter à vista' })).toBeVisible();
});
