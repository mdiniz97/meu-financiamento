import { expect, test, type Page } from '@playwright/test';

async function cadastrarIlimitado(page: Page) {
  const email = `aporte-${Date.now()}-${crypto.randomUUID()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  const signupResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/signup') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  const signupResponse = await signupResponsePromise;
  expect(signupResponse.ok()).toBeTruthy();
  const { id: uid } = await signupResponse.json() as { id?: string };
  expect(uid).toBeTruthy();
  await page.waitForURL(/nova-simulacao/);

  const response = await page.request.get(
    `http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
  return uid!;
}

test('webhook fake exige sessão e impede aprovação para outra conta', async ({ page }) => {
  const unauthenticated = await page.request.get(
    'http://localhost:3000/api/webhooks/payments?userId=arbitrary&packId=unlimited'
  );
  expect(unauthenticated.status()).toBe(401);

  const ownUserId = await cadastrarIlimitado(page);
  const own = await page.request.get(
    `http://localhost:3000/api/webhooks/payments?userId=${ownUserId}&packId=unlimited`
  );
  expect(own.ok()).toBeTruthy();

  const otherSignup = await page.request.post('http://localhost:3000/api/signup', {
    data: {
      name: 'Outra conta',
      email: `other-${Date.now()}-${crypto.randomUUID()}@teste.com`,
      password: 'senha123',
    },
  });
  expect(otherSignup.ok()).toBeTruthy();
  const { id: otherUserId } = await otherSignup.json() as { id: string };
  const mismatched = await page.request.get(
    `http://localhost:3000/api/webhooks/payments?userId=${otherUserId}&packId=unlimited`
  );
  expect(mismatched.status()).toBe(403);
});

test('aplica 14,17% recomendado e dívida cai desde o mês 1', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('button', { name: /aplicar aporte/i }).click();

  const percentInputs = page.getByRole('textbox', { name: 'Percentual (%)' });
  await expect(percentInputs).toHaveCount(1);
  await expect(percentInputs).toHaveValue(/14[,.]17/);
  await expect(page.getByRole('textbox', { name: 'Até o mês (opcional)' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Modo' })).toContainText('Reduzir prazo');

  const firstInstallment = page.locator('table tbody tr').first();
  const amortization = await firstInstallment.locator('td').nth(5).innerText();
  const balance = await firstInstallment.locator('td').nth(8).innerText();
  const brl = (value: string) => Number(value.replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.'));
  expect(brl(amortization)).toBeGreaterThan(0);
  expect(brl(balance)).toBeLessThan(1_000_000);
});

test('substitui aporte percentual existente sem criar duplicado', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('button', { name: 'Adicionar amortização' }).click();
  await page.getByRole('combobox', { name: 'Tipo de amortização' }).click();
  await page.getByRole('option', { name: '% extra mensal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Percentual (%)' }).fill('5');
  await page.getByRole('button', { name: /aplicar aporte/i }).click();

  const percentInputs = page.getByRole('textbox', { name: 'Percentual (%)' });
  await expect(percentInputs).toHaveCount(1);
  await expect(percentInputs).toHaveValue(/14[,.]17/);
});

test('aporte recomendado acima de 100% fica indisponível sem erro', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.locator('#trMonthly').fill('1');
  await page.locator('#months').fill('600');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await expect(page.getByText(/aporte acima de 100%; reduza o prazo/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /aplicar aporte/i })).toBeDisabled();
});

test('legado com até o mês 400 em contrato de 360 carrega clampado em 360 sem quebrar', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.addInitScript((payload) => {
    sessionStorage.setItem(payload.key, payload.value);
  }, { key: 'sim-input', value: JSON.stringify({ fixedPayment: '12000', fixedPaymentUntil: '400' }) });
  await page.goto('/simulacao?name=');

  await expect(page.getByRole('textbox', { name: 'Até o mês (opcional)' })).toHaveValue('360');
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('digitar até o mês acima do prazo clampa em 360 sem quebrar a simulação', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('button', { name: 'Adicionar amortização' }).click();
  await page.getByRole('combobox', { name: 'Tipo de amortização' }).click();
  await page.getByRole('option', { name: 'Mensal (total fixo)', exact: true }).click();
  await page.getByRole('textbox', { name: 'Valor (R$)' }).fill('12000');

  const until = page.getByRole('textbox', { name: 'Até o mês (opcional)' });
  await until.fill('400');
  await until.blur();
  await expect(until).toHaveValue('360');
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('legado com mês inicial 400 em contrato de 360: linha removida, sem aporte criado', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.addInitScript((payload) => {
    sessionStorage.setItem(payload.key, payload.value);
  }, { key: 'sim-input', value: JSON.stringify({ fixedPayment: '12000', fixedPaymentStart: '400' }) });
  await page.goto('/simulacao?name=');

  await expect(page.getByText(/nenhuma amortização definida/i)).toBeVisible();
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('digitar mês de início acima do prazo remove a linha (não aporta no último mês)', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('button', { name: 'Adicionar amortização' }).click();
  await page.getByRole('textbox', { name: 'Mês do aporte' }).fill('400');

  await expect(page.getByText(/nenhuma amortização definida/i)).toBeVisible();
});

test('linha com valor zero mostra estado inativo com dica e segue removível', async ({ page }) => {
  await cadastrarIlimitado(page);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: 'Simular', exact: true }).click();
  await page.waitForURL(/simulacao/);

  await page.getByRole('button', { name: 'Adicionar amortização' }).click();
  await expect(page.getByText(/valor zero: aporte inativo/i)).toBeVisible();

  await page.getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByText(/nenhuma amortização definida/i)).toBeVisible();
});
