import { execSync } from 'node:child_process';
import { test, expect, type Page } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function cadastrar(page: Page, prefix: string) {
  const email = `${prefix}${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  return email;
}

async function assinar(page: Page, email: string) {
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const response = await page.request.get(
    `http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(response.ok()).toBeTruthy();
}

test('não assinante vê gate do imóvel no bolso', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page, 'aff-lock');
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await expect(page.getByText(/recurso exclusivo do plano ilimitado/i)).toBeVisible();
});

test('Ilimitado calcula cenários na página e mantém modal no cálculo inteligente', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff');
  await assinar(page, email);

  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Conservador', { exact: true })).toBeVisible();
  await expect(page.getByText('Recomendado', { exact: true })).toBeVisible();
  await expect(page.getByText('Máximo', { exact: true })).toBeVisible();
  await expect(page.getByText(/imóvel máximo/i).first()).toBeVisible();
  await page.getByRole('button', { name: /levar ao simulador/i }).first().click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/total pago/i).first()).toBeVisible();

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Qual imóvel cabe no meu bolso?');
  await page.getByRole('dialog').getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByRole('dialog').getByText('Recomendado', { exact: true })).toBeVisible();
});

test('Ilimitado calcula valor financiável diretamente pela parcela na página e no modal', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-payment');
  await assinar(page, email);

  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await expect(page.getByRole('textbox', { name: /renda mensal/i })).toBeHidden();
  await page.getByRole('textbox', { name: /parcela máxima/i }).fill('500000');
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/máximo pela parcela inicial/i).first()).toBeVisible();
  await expect(page.getByText(/máximo seguro no contrato/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /levar ao simulador/i })).toHaveCount(4);

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /por parcela/i }).click();
  await expect(dialog.getByRole('textbox', { name: /renda mensal/i })).toBeHidden();
  await dialog.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(dialog.getByText(/máximo seguro no contrato/i).first()).toBeVisible();
});

test('abas controlam painéis e ativam modos pelas setas', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-tabs');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');

  const incomeTab = page.getByRole('tab', { name: /por renda e entrada/i });
  const paymentTab = page.getByRole('tab', { name: /por parcela/i });
  await expect(incomeTab).toHaveAttribute('aria-selected', 'true');
  await expect(incomeTab).toHaveAttribute('aria-controls', /.+/);
  const incomePanelId = await incomeTab.getAttribute('aria-controls');
  expect(incomePanelId).toBeTruthy();
  await expect(page.locator(`#${incomePanelId}`)).toBeVisible();

  await incomeTab.focus();
  await incomeTab.press('ArrowRight');
  await expect(paymentTab).toBeFocused();
  await paymentTab.press('Enter');
  await expect(paymentTab).toHaveAttribute('aria-selected', 'true');
  await expect(paymentTab).toHaveAttribute('aria-controls', /.+/);
  const paymentPanelId = await paymentTab.getAttribute('aria-controls');
  expect(paymentPanelId).toBeTruthy();
  await expect(page.locator(`#${paymentPanelId}`)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /renda mensal/i })).toBeHidden();

  await paymentTab.press('ArrowLeft');
  await expect(incomeTab).toBeFocused();
  await incomeTab.press('Enter');
  await expect(incomeTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: /renda mensal/i })).toBeVisible();
});

test('modo por parcela bloqueia resultado com taxa inválida e não contamina renda', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-payment-validity');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/máximo seguro no contrato/i).first()).toBeVisible();

  const rate = page.getByRole('textbox', { name: 'Taxa de juros', exact: true });
  await rate.fill('-');
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText('Informe uma taxa válida.').last()).toBeVisible();
  await expect(page.getByText(/máximo seguro no contrato/i)).toBeHidden();

  await rate.fill('10,5');
  const payment = page.getByRole('textbox', { name: /parcela máxima/i });
  await payment.fill('12345678901234');
  await expect(payment).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('tab', { name: /por renda e entrada/i }).click();
  await expect(page.getByRole('textbox', { name: /renda mensal/i })).toHaveValue(/^R\$\s20\.000,00$/);
  await expect(page.getByText('Conservador', { exact: true })).toBeHidden();
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await expect(payment).toHaveValue(/^R\$\s5\.000,00$/);
});

test('troca de modo descarta validade falsa de drafts desmontados', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-mode-validity-reset');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');

  const incomeMonths = page.getByRole('textbox', { name: /prazo \(meses\)/i });
  await expect(incomeMonths).toHaveValue('360');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Conservador', { exact: true })).toBeVisible();
  await incomeMonths.fill('360abc');
  await expect(incomeMonths).toHaveValue('360abc');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText(/corrija os campos inválidos/i)).toBeVisible();
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await page.getByRole('tab', { name: /por renda e entrada/i }).click();
  await expect(page.getByRole('textbox', { name: /prazo \(meses\)/i })).toHaveValue('360');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Conservador', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /por parcela/i }).click();
  const directCap = page.getByRole('textbox', { name: 'Parcela máxima (R$)', exact: true });
  await expect(directCap).toHaveValue(/^R\$\s5\.000,00$/);
  await directCap.fill('12345678901234');
  await expect(directCap).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('tab', { name: /por renda e entrada/i }).click();
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await expect(directCap).toHaveValue(/^R\$\s5\.000,00$/);
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/máximo seguro no contrato/i).first()).toBeVisible();
});

test('modo por parcela bloqueia resultado anterior com prazo ou TR inválidos', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-payment-shared-validity');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/máximo seguro no contrato/i).first()).toBeVisible();

  await page.getByRole('textbox', { name: /prazo \(meses\)/i }).fill('-');
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/corrija os campos inválidos/i)).toBeVisible();
  await expect(page.getByText(/máximo seguro no contrato/i)).toBeHidden();

  await page.getByRole('textbox', { name: /prazo \(meses\)/i }).fill('360');
  await page.getByRole('textbox', { name: /tr mensal/i }).fill('-');
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(page.getByText(/corrija os campos inválidos/i)).toBeVisible();
  await expect(page.getByText(/máximo seguro no contrato/i)).toBeHidden();
});

test('affordability rejeita prazo fracionário ou contaminado sem calcular', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-integer-months');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  const months = page.getByRole('textbox', { name: /prazo \(meses\)/i });
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Conservador', { exact: true })).toBeVisible();

  for (const invalid of ['12.5', '360abc']) {
    await months.fill(invalid);
    await months.blur();
    await expect(months).toHaveValue('360');
    await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
    await expect(page.getByText(/corrija os campos inválidos/i)).toBeVisible();
    await expect(page.getByText('Conservador', { exact: true })).toBeHidden();
  }
});

test('alternativas sem principal não transferem nem navegam', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-zero-principal');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('tab', { name: /por parcela/i }).click();
  await page.getByRole('textbox', { name: /parcela máxima/i }).fill('10000');
  await page.getByRole('button', { name: /calcular valor financiável/i }).click();

  await expect(page.getByText('Nenhum valor financiável')).toHaveCount(4);
  const transfers = page.getByRole('button', { name: /levar ao simulador/i });
  await expect(transfers).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) await expect(transfers.nth(index)).toBeDisabled();
  await transfers.first().evaluate((button: HTMLButtonElement) => button.click());
  await expect(page).toHaveURL(/qual-imovel-cabe-no-meu-bolso/);
  expect(await page.evaluate(() => sessionStorage.getItem('sim-input'))).toBeNull();
});

test('transferência direta grava valores monetários em formato BRL para /simulacao', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-direct-transfer');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('textbox', { name: 'Seguro (R$/mês)' }).fill('12345');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await page.getByRole('button', { name: /levar ao simulador/i }).first().click();
  await page.waitForURL(/simulacao/);

  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.principal).toMatch(/^\d+,\d{2}$/);
  expect(stored.insuranceMonthly).toBe('123,45');
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('alternativa segura por parcela transfere principal e taxa normalizada ao Smart', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-payment-transfer');
  await assinar(page, email);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /por parcela/i }).click();
  await dialog.getByRole('combobox', { name: /tipo de taxa de juros/i }).click();
  await page.getByRole('option', { name: 'Nominal a.a.', exact: true }).click();
  await dialog.getByRole('button', { name: /calcular valor financiável/i }).click();
  const safe = dialog.getByText('Máximo seguro no contrato', { exact: true }).first().locator('..');
  const safePrincipal = await safe.locator('span').nth(1).textContent();
  await safe.getByRole('button', { name: /levar ao simulador/i }).click();

  await expect(page.locator('#smartPrincipal')).toHaveValue(safePrincipal!.replace(/\s/, '\u00a0'));
  await expect(page.locator('#smartRate')).not.toHaveValue('10.5');
  await expect(page.getByRole('combobox', { name: /tipo de taxa de juros/i }).nth(1)).toContainText('Efetiva a.a.');
});

test('modal de affordability permanece rolável em viewport mobile', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-payment-mobile');
  await assinar(page, email);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /por parcela/i }).click();
  await dialog.getByRole('button', { name: /calcular valor financiável/i }).click();
  await expect(dialog).toHaveCSS('overflow-y', 'auto');
  expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('taxa com texto inválido bloqueia affordability e cálculo inteligente', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-rate');
  await assinar(page, email);

  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Conservador', { exact: true })).toBeVisible();
  const affordabilityRate = page.getByRole('textbox', { name: 'Taxa de juros', exact: true });
  await affordabilityRate.fill('-');
  await expect(affordabilityRate).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  await expect(page.getByText('Informe uma taxa válida.').last()).toBeVisible();
  await expect(page.getByText('Conservador', { exact: true })).toBeHidden();

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
  const smartRate = page.getByRole('textbox', { name: 'Taxa de juros', exact: true }).nth(1);
  await smartRate.fill('-');
  await expect(smartRate).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Informe uma taxa válida.').last()).toBeVisible();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeHidden();
});

test('tentativa Smart inválida remove recomendação anterior', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'smart-stale');
  await assinar(page, email);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Prazo máximo (meses)' }).fill('1');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText(/prazo máximo deve estar entre 60 e 600/i)).toBeVisible();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeHidden();
});

test('affordability transfere principal, orçamento e seguro com centavos exatos ao Smart', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-cents');
  await assinar(page, email);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Renda mensal familiar (R$)' }).fill('1234567');
  await dialog.getByRole('textbox', { name: 'Seguro (R$/mês)' }).fill('12345');
  await dialog.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  const recommended = dialog.getByText('Recomendado', { exact: true }).locator('..').locator('..');
  const financedText = await recommended.getByText(/Financia R\$/).first().textContent();
  const financed = financedText?.match(/Financia (R\$\s?[\d.]+,\d{2})/)?.[1].replace(/\s/, '\u00a0');
  expect(financed).toBeTruthy();
  await recommended.getByRole('button', { name: /levar ao simulador/i }).first().click();

  const smartPrincipal = page.locator('#smartPrincipal');
  const smartBudget = page.locator('#smartMaxPayment2');
  const smartInsurance = page.locator('#smartSeguro');
  await expect(smartPrincipal).toHaveValue(financed!);
  await expect(smartBudget).toHaveValue(/^R\$\s3\.086,42$/);
  await expect(smartInsurance).toHaveValue(/^R\$\s123,45$/);
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
});

test('seleção válida do affordability recupera taxa Smart inválida', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-rate-recovery');
  await assinar(page, email);
  await page.goto('/nova-simulacao');

  await page.getByRole('textbox', { name: 'Taxa de juros', exact: true }).nth(1).fill('-');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /calcular imóvel máximo/i }).click();
  const recommended = dialog.getByText('Recomendado', { exact: true }).locator('..').locator('..');
  await recommended.getByRole('button', { name: /levar ao simulador/i }).first().click();

  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
});

test('edições relevantes invalidam resultado e exigem novo cálculo antes de transferir', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-stale-result');
  await assinar(page, email);
  await page.goto('/qual-imovel-cabe-no-meu-bolso');

  const edits: Array<[ReturnType<Page['getByRole']>, string]> = [
    [page.getByRole('textbox', { name: 'Taxa de juros', exact: true }), '9'],
    [page.getByRole('textbox', { name: /tr mensal/i }), '0,1'],
    [page.getByRole('textbox', { name: /prazo \(meses\)/i }), '240'],
    [page.getByRole('textbox', { name: /parcela máxima/i }), '450000'],
  ];
  for (const [field, value] of edits) {
    await page.getByRole('button', { name: /calcular imóvel máximo/i }).click();
    await expect(page.getByText('Conservador', { exact: true })).toBeVisible();
    await field.fill(value);
    await expect(page.getByText('Conservador', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /levar ao simulador/i })).toHaveCount(0);
  }
});

test('taxa zero calcula por parcela e seleção SAC permanece no Smart', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'aff-zero-rate-system');
  await assinar(page, email);
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /descobrir quanto posso financiar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: /por parcela/i }).click();
  await dialog.getByRole('textbox', { name: 'Taxa de juros', exact: true }).fill('0');
  await dialog.getByRole('textbox', { name: /tr mensal/i }).fill('0');
  await dialog.getByRole('button', { name: /calcular valor financiável/i }).click();
  const sac = dialog.getByRole('heading', { name: 'SAC', exact: true }).locator('..');
  await sac.getByRole('button', { name: /levar ao simulador/i }).last().click();

  await expect(page.getByRole('combobox', { name: /sistema preferido/i })).toContainText('SAC');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  await expect(page.getByText('Melhor modelo', { exact: true })).toBeVisible();
});
