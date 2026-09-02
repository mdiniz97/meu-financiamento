import { expect, test, type Page } from '@playwright/test';

async function cadastrar(page: Page) {
  const email = `decisao-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('meta de quitação calcula aporte e salva em minhas simulações', async ({ page }) => {
  await cadastrar(page);
  await page.goto('/meta-de-quitacao');

  await expect(page.getByRole('heading', { name: 'Meta de quitação' })).toBeVisible();
  await expect(page.getByRole('button', { name: /calcular aporte/i })).toContainText('-1');

  await page.getByRole('button', { name: /calcular aporte/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  await expect(page.getByText('Pagamento total', { exact: true })).toBeVisible();
  await expect(page.getByText('Economia de juros', { exact: true })).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/meta de quitação/i).first()).toBeVisible();
});

test('alugar ou comprar compara patrimônios e mostra o mês de empate', async ({ page }) => {
  await cadastrar(page);
  await page.goto('/alugar-ou-comprar');

  await expect(page.getByRole('heading', { name: 'Alugar ou comprar?' })).toBeVisible();
  await page.getByRole('button', { name: /comparar/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  await expect(page.getByText(/patrimônio comprando/i).first()).toBeVisible();
  await expect(page.getByText(/patrimônio alugando/i).first()).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/alugar ou comprar/i).first()).toBeVisible();
});

test('consórcio vs financiamento compara custos', async ({ page }) => {
  await cadastrar(page);
  await page.goto('/consorcio-vale-a-pena');

  await expect(page.getByRole('heading', { name: 'Consórcio vale a pena?' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /financiamento/i })).toBeVisible();
  await page.getByRole('button', { name: /comparar/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  await expect(page.getByText(/consórcio mais barato no total/i).first()).toBeVisible();
  await expect(page.getByText('Custo dos juros', { exact: true })).toBeVisible();
  await expect(page.getByText(/no consórcio, o imóvel não sai na hora/i)).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/consórcio vs financiamento/i).first()).toBeVisible();
});

test('consórcio vs investir mostra quando o investimento compra à vista', async ({ page }) => {
  await cadastrar(page);
  await page.goto('/consorcio-vale-a-pena');

  await page.getByRole('tab', { name: /investir/i }).click();
  await page.getByRole('button', { name: /comparar/i }).click();
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  await expect(page.getByText(/investindo, você compra à vista/i).first()).toBeVisible();
  await expect(page.getByText(/quando o consórcio vale\?/i)).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/consórcio vs investir/i).first()).toBeVisible();
});
