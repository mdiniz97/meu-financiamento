import { expect, test, type Page } from '@playwright/test';

async function cadastrar(page: Page) {
  const email = `field-help${Date.now()}-${crypto.randomUUID()}@teste.com`;
  await page.goto('/cadastro');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test.beforeEach(async ({ page }) => {
  await cadastrar(page);
});

test('ajuda da taxa funciona por clique, foco, hover e Escape', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const help = page.getByRole('button', { name: 'Ajuda sobre Taxa de juros' });
  const popup = page.getByRole('dialog');
  const description = page.locator('#annualRate-help');

  await expect(field).toBeVisible();
  await expect(description).toContainText(/efetiva/i);
  await expect(description).toBeAttached();
  await help.click();
  await expect(popup).toContainText(/efetiva/i);
  await expect(popup).toHaveAttribute('id', 'annualRate-help-popup');
  await expect(help).toHaveAttribute('aria-controls', 'annualRate-help-popup');
  await expect(field).toHaveAttribute('aria-describedby', 'annualRate-help');

  await help.press('Escape');
  await expect(popup).toBeHidden();
  await expect(description).toBeAttached();
  await expect(field).toHaveAttribute('aria-describedby', 'annualRate-help');

  await page.getByRole('textbox', { name: 'Valor financiado (R$)' }).focus();
  await page.keyboard.press('Tab');
  await expect(help).toBeFocused();
  await expect(popup).toBeVisible();
  await help.press('Escape');
  await expect(help).toBeFocused();

  await page.mouse.move(0, 0);
  await help.hover();
  await expect(popup).toBeVisible();
  await page.getByRole('textbox', { name: 'Valor financiado (R$)' }).click();
  await expect(popup).toBeHidden();
});

test.describe('em dispositivo touch', () => {
  test.use({ hasTouch: true });

  test('ajuda da taxa abre por toque e fecha com Escape', async ({ page }) => {
    const help = page.getByRole('button', { name: 'Ajuda sobre Taxa de juros' });
    const popup = page.getByRole('dialog');

    await help.tap();
    await expect(popup).toContainText(/efetiva/i);
    await help.press('Escape');
    await expect(popup).toBeHidden();
  });
});

test('taxa converte três tipos e persiste valor visual com significado', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const kind = page.getByRole('combobox', { name: 'Tipo de Taxa de juros' });

  await field.fill('12');
  await expect(page.getByText('Equivale a 12.00% a.a. efetivos e 0.9489% a.m.')).toBeVisible();

  await kind.click();
  await page.getByRole('option', { name: 'Nominal a.a.' }).click();
  await expect(field).toHaveValue('12');
  await expect(page.getByText('Equivale a 12.68% a.a. efetivos e 1.0000% a.m.')).toBeVisible();

  await kind.click();
  await page.getByRole('option', { name: 'Efetiva a.m.' }).click();
  await field.fill('1');
  await expect(page.getByText('Equivale a 12.68% a.a. efetivos e 1.0000% a.m.')).toBeVisible();

  await page.getByRole('button', { name: 'Simular' }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.annualRate).toBe('1');
  expect(stored.annualRateKind).toBe('effective-monthly');
  expect(pageErrors).toEqual([]);
});

test('taxa nominal anual de 12% simula como 12,68% efetivos', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const kind = page.getByRole('combobox', { name: 'Tipo de Taxa de juros' });

  await kind.click();
  await page.getByRole('option', { name: 'Nominal a.a.' }).click();
  await field.fill('12');
  await expect(page.getByText('Equivale a 12.68% a.a. efetivos e 1.0000% a.m.')).toBeVisible();
  await page.getByRole('button', { name: 'Simular' }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/12\.68% a\.a\./)).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.annualRate).toBe('12');
  expect(stored.annualRateKind).toBe('nominal-annual');
});

test('taxa sintaticamente inválida bloqueia simulação', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });

  await field.fill('-');
  await expect(field).toHaveValue('-');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Informe uma taxa válida.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page).toHaveURL(/nova-simulacao/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
});

test('taxa zero é válida para simulação', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });

  await field.fill('0');
  await expect(field).toHaveValue('0');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Simular' }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('taxa acima de 100% efetivos ao ano bloqueia simulação', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const kind = page.getByRole('combobox', { name: 'Tipo de Taxa de juros' });

  await kind.click();
  await page.getByRole('option', { name: 'Efetiva a.m.' }).click();
  await field.fill('10');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('A taxa deve equivaler a no máximo 100% a.a.')).toBeVisible();
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page).toHaveURL(/nova-simulacao/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
});

test('troca de tipo revalida valor visual sem usar estado inválido anterior', async ({ page }) => {
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const kind = page.getByRole('combobox', { name: 'Tipo de Taxa de juros' });

  await kind.click();
  await page.getByRole('option', { name: 'Efetiva a.m.' }).click();
  await field.fill('7');
  await expect(field).toHaveAttribute('aria-invalid', 'true');

  await kind.click();
  await page.getByRole('option', { name: 'Nominal a.a.' }).click();
  await expect(field).toHaveValue('7');
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Equivale a 7.23% a.a. efetivos e 0.5833% a.m.')).toBeVisible();

  await page.getByRole('button', { name: 'Simular' }).click();
  await page.waitForURL(/simulacao/);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.annualRate).toBe('7');
  expect(stored.annualRateKind).toBe('nominal-annual');
});

test('taxa transitória inválida bloqueia simulação sem corromper canônico', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  const field = page.getByRole('textbox', { name: 'Taxa de juros' });
  const kind = page.getByRole('combobox', { name: 'Tipo de Taxa de juros' });

  await field.fill('1201');
  await expect(page.getByText(/^Equivale a /)).toBeHidden();
  await kind.click();
  await page.getByRole('option', { name: 'Efetiva a.m.' }).click();
  await page.getByRole('button', { name: 'Simular' }).click();
  await expect(page.getByText(/informe uma taxa válida/i).first()).toBeVisible();
  await expect(page).toHaveURL(/nova-simulacao/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('rascunhos inválidos de prazo e TR não submetem valores controlados anteriores', async ({ page }) => {
  const simulate = page.getByRole('button', { name: 'Simular', exact: true });
  const months = page.getByRole('textbox', { name: 'Prazo (meses)' });
  await months.fill('1.5');
  await simulate.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page).toHaveURL(/nova-simulacao/);
  await expect(page.getByText(/Informe um prazo válido/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();

  await months.fill('360');
  await expect(months).toHaveValue('360');
  const tr = page.getByRole('textbox', { name: 'TR mensal (%)' });
  await tr.fill('abc');
  await simulate.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page).toHaveURL(/nova-simulacao/);
  await expect(months).toHaveValue('360');
  await expect(page.getByText(/Informe a TR mensal válida/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
});
