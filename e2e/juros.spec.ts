import { expect, test, type Page } from '@playwright/test';

async function cadastrar(page: Page) {
  const email = `juros-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('página de juros é pública e mostra as três seções sem erro', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/juros');
  await expect(page.getByRole('heading', { name: 'Juros de mercado', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Indicadores do mês' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Histórico de 12 meses' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Taxas imobiliárias por instituição' })).toBeVisible();

  await expect(page.getByText('Selic', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('IPCA', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('TR', { exact: true }).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('indica origem BACEN e mostra acumulados do ano e de 12 meses', async ({ page }) => {
  await page.goto('/juros');
  await expect(page.getByText('Fonte: BACEN').first()).toBeVisible();
  await expect(page.getByText(/Banco Central do Brasil \(BACEN\)/).first()).toBeVisible();
  await expect(page.getByText('Acumulado no ano').first()).toBeVisible();
  await expect(page.getByText('Acumulado 12 meses').first()).toBeVisible();
});

test('taxas imobiliárias ficam ordenadas da menor para a maior', async ({ page }) => {
  await page.goto('/juros');
  const tables = page.locator('section table');
  const count = await tables.count();
  if (count === 0) return;

  let previousFirst = -Infinity;
  for (let index = 0; index < count; index += 1) {
    const rates = (await tables.nth(index).locator('tbody tr td:nth-child(3)').allTextContents()).map(
      (text) => Number(text.replace(/\./g, '').replace(',', '.').replace('%', ''))
    );
    expect(rates.length).toBeGreaterThan(0);
    const ascending = [...rates].every((rate, i) => i === 0 || rates[i - 1]! <= rate);
    expect(ascending).toBe(true);
    expect(rates[0]!).toBeGreaterThanOrEqual(previousFirst);
    previousFirst = rates[0]!;
  }
});

test('toggle de tema é o último item da navbar da landing', async ({ page }) => {
  await page.goto('/juros');
  await expect(page.getByRole('button', { name: /ativar tema/i })).toBeVisible();
  const last = page.locator('header nav > *').last();
  expect(await last.evaluate((element) => element.tagName)).toBe('BUTTON');
});

test('sidebar tem link Juros de mercado e navega sem sair do app', async ({ page }) => {
  await cadastrar(page);
  await page.getByRole('link', { name: 'Juros de mercado', exact: true }).click();
  await page.waitForURL(/\/juros$/);
  await expect(page.getByRole('heading', { name: 'Juros de mercado', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Simulações', exact: true })).toBeVisible();
});
