import { DB_URL } from './helpers/db';
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
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  return email;
}

async function assinar(page: Page, email: string) {
  const uid = execSync(
    `psql "${DB_URL}" -t -A -c "select id from users where email='${email}'"`
  )
    .toString()
    .trim();
  const res = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(res.ok()).toBeTruthy();
}

async function preencherProposta(page: Page, index: number, bank: string, entradaCents: string) {
  await page.getByRole('textbox', { name: 'Banco' }).nth(index).fill(bank);
  await page.getByRole('textbox', { name: 'Imóvel (R$)' }).nth(index).fill('85000000');
  await page.getByRole('textbox', { name: 'Entrada (R$)' }).nth(index).fill(entradaCents);
  if (index === 0) await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).first().fill('9,7');
  if (index === 0) await page.getByRole('textbox', { name: 'CET efetivo anual informado (%)', exact: true }).first().fill('10,42');
  if (index === 1) await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(1).fill('9,2');
  if (index === 1) await page.getByRole('textbox', { name: 'CET efetivo anual informado (%)', exact: true }).nth(1).fill('11,6');
  if (index === 2) await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(2).fill('9,45');
  if (index === 2) await page.getByRole('textbox', { name: 'CET efetivo anual informado (%)', exact: true }).nth(2).fill('10,31');
}

test('não assinante vê card de upgrade sem acesso à ferramenta', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrar(page, 'b');
  await page.goto('/comparar-propostas');
  await expect(page.getByText('Recurso exclusivo do plano Ilimitado')).toBeVisible();
  await expect(page.getByRole('button', { name: /ver opções de acesso/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Banco' }).first()).not.toBeVisible();
});

test('ilimitado compara 2 propostas, adiciona 3ª, vê ranking + alerta CET, salva, PDF e leva ao simulador', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'c');
  await assinar(page, email);
  await page.goto('/comparar-propostas');

  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await expect(page.getByRole('textbox', { name: 'Banco' })).toHaveCount(3);
  await preencherProposta(page, 2, 'Santander', '27000000');

  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
  await expect(page.getByText(/custo total da aquisição/i)).toBeVisible();
  await expect(page.getByText(/alerta de cet/i)).toBeVisible();
  await expect(page.getByText(/amortizador inteligente/i).first()).toBeVisible();
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeVisible({ timeout: 15000 });

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/caixa vs itaú/i)).toBeVisible();
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.waitForURL(/id=/);
  await page.reload();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Banco' }).nth(1)).toHaveValue('Itaú');
  await expect(page.getByText(/melhor proposta: santander/i)).toBeVisible();

  const pdfResponse = page.waitForResponse((r) => r.url().includes('/api/pdf/comparison'));
  await page.getByRole('button', { name: /gerar pdf/i }).click();
  expect((await pdfResponse).status()).toBe(200);

  await page.getByRole('button', { name: /levar ao simulador/i }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
});

test('preserva taxas nominal e mensal ao salvar, reabrir e transferir canônico', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'rate-roundtrip');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  const kinds = page.getByRole('combobox', { name: 'Tipo de Taxa contratual' });
  await kinds.nth(0).click();
  await page.getByRole('option', { name: 'Nominal a.a.' }).click();
  await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(0).fill('12.3456');
  await kinds.nth(1).click();
  await page.getByRole('option', { name: 'Efetiva a.m.' }).click();
  await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(1).fill('0.7654');

  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeVisible({ timeout: 15000 });
  await page.goto('/minhas-simulacoes');
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.waitForURL(/id=/);
  await page.reload();

  await expect(page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(0)).toHaveValue('12.3456');
  await expect(page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).nth(1)).toHaveValue('0.7654');
  await expect(kinds.nth(0)).toContainText('Nominal a.a.');
  await expect(kinds.nth(1)).toContainText('Efetiva a.m.');
  await expect(page.getByText(/Equivale a 13\.07% a\.a\./).first()).toBeVisible();
  await expect(page.getByText(/Equivale a 9\.58% a\.a\./).first()).toBeVisible();

  const bestBank = (await page.getByText(/Melhor proposta:/).first().textContent()) ?? '';
  await page.getByRole('button', { name: /levar ao simulador/i }).click();
  await page.waitForURL(/simulacao/);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.annualRateKind).toBe('effective-annual');
  const expectedEffectivePercent = bestBank.includes('Caixa')
    ? (1 + 12.3456 / 1200) ** 12 * 100 - 100
    : ((1 + 0.7654 / 100) ** 12 - 1) * 100;
  expect(Number(stored.annualRate)).toBeCloseTo(expectedEffectivePercent, 10);
});

test('preserva principal manual ao comparar, salvar, reabrir, gerar PDF e transferir', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'principal-roundtrip');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('textbox', { name: 'Valor financiado (R$)' }).first().fill('61000000');
  await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).first().fill('1');

  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta: caixa/i)).toBeVisible();
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeVisible({ timeout: 15000 });
  await page.goto('/minhas-simulacoes');
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.waitForURL(/id=/);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Valor financiado (R$)' }).first()).toHaveValue(/^R\$\s610\.000,00$/);
  await expect(page.getByText(/ajustado manualmente/i).first()).toBeVisible();

  const pdfResponse = page.waitForResponse((response) => response.url().includes('/api/pdf/comparison'));
  await page.getByRole('button', { name: /gerar pdf/i }).click();
  expect((await pdfResponse).status()).toBe(200);
  await page.getByRole('button', { name: /^levar ao simulador/i }).click();
  await page.waitForURL(/simulacao/);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sim-input') ?? '{}'));
  expect(stored.principal).toBe('610000');
});

test('texto de taxa inválido bloqueia comparação', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'rate-invalid');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).first().fill('-');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await expect(page.getByText(/taxa contratual: informe um número válido/i)).toBeVisible();
  await expect(page.getByText(/melhor proposta/i)).toBeHidden();
});

test('tentativa inválida não mantém resultado nem permite salvar input novo', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'compare-stale');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeVisible({ timeout: 15000 });

  await page.getByRole('textbox', { name: 'Prazo (meses)' }).first().fill('0');
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeHidden();
  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/prazo deve ser inteiro entre 1 e 600/i)).toBeVisible();
  await expect(page.getByText(/melhor proposta:/i)).toBeHidden();
});

test('API PDF rejeita cardinalidade excessiva antes de renderizar', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'pdf-limits');
  await assinar(page, email);
  const base = {
    id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000,
    system: 'SAC', months: 360, annualRate: 0.1, cetInformed: 0.11, trMonthly: 0.0017,
    insuranceMonthly: 100, fees: [],
  };
  const requestPdf = (proposals: unknown[]) => page.request.get(`/api/pdf/comparison?${new URLSearchParams({
    proposals: JSON.stringify(proposals),
    monthlyBudget: '12000',
  })}`);

  const tooManyProposals = await requestPdf(Array.from({ length: 4 }, (_, i) => ({ ...base, id: `p${i}` })));
  expect(tooManyProposals.status()).toBe(400);
  const tooManyFees = await requestPdf([
    { ...base, fees: Array.from({ length: 21 }, (_, i) => ({ id: `f${i}`, label: 'Tarifa', amount: 1, includeInCet: false })) },
    { ...base, id: 'p2', bank: 'Itaú' },
  ]);
  expect(tooManyFees.status()).toBe(400);
  const malformedBank = await requestPdf([{ ...base, bank: {} }, { ...base, id: 'p2', bank: 'Itaú' }]);
  expect(malformedBank.status()).toBe(400);
});

test('sintaxe inválida de prazo, CET e TR remove resultado e recupera', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'numeric-validity');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  const cases = [
    { name: 'prazo', field: page.getByRole('textbox', { name: 'Prazo (meses)' }).first(), valid: '360' },
    { name: 'CET', field: page.getByRole('textbox', { name: 'CET efetivo anual informado (%)', exact: true }).first(), valid: '10,42' },
    { name: 'TR', field: page.getByRole('textbox', { name: 'TR mensal (%)' }).first(), valid: '0,17' },
  ];
  for (const item of cases) {
    await test.step(item.name, async () => {
      await page.getByRole('button', { name: /comparar propostas/i }).click();
      await expect(page.getByText(/melhor proposta:/i)).toBeVisible();
      await item.field.fill('-');
      await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
      await expect(page.getByText(/melhor proposta:/i)).toBeHidden();
      await item.field.fill(item.valid);
      await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();
      await page.getByRole('button', { name: /comparar propostas/i }).click();
      await expect(page.getByText(/melhor proposta:/i)).toBeVisible();
    });
  }
});

test('blur e novo foco restauram taxa canônica e validade completa', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'rate-focus-recovery');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  const rate = page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).first();
  await rate.fill('-');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Banco' }).first().click();
  await expect(rate).toHaveValue('9.7');
  await rate.focus();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();
  await expect(page.getByText(/taxa contratual: informe um número válido/i)).toBeHidden();
  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
});

test('novo foco não limpa validade quando taxa canônica excede máximo', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'rate-domain-focus');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');

  const rate = page.getByRole('textbox', { name: 'Taxa contratual', exact: true }).first();
  await rate.fill('101');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Banco' }).first().click();
  await rate.focus();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await expect(page.getByText(/no máximo 100% a\.a\./i)).toBeVisible();
});

test('MoneyInput recupera validade agregada após rejeição e novo foco', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'money-validity-recovery');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  const principal = page.getByRole('textbox', { name: 'Valor financiado (R$)' }).first();
  await principal.fill('1234567890123');
  await principal.blur();
  await principal.focus();
  await principal.fill('12345678901234');
  await expect(principal).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await principal.blur();
  await expect(principal).not.toHaveAttribute('aria-invalid', 'true');
  await principal.focus();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();
  await expect(principal).toHaveAttribute('aria-describedby', /p1-principal-help/);
});

test('remover proposta inválida limpa aggregate inclusive após reutilizar ID', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'remove-invalid');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await preencherProposta(page, 2, 'Santander', '27000000');

  await page.getByRole('textbox', { name: 'Prazo (meses)' }).nth(2).fill('-');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await page.getByRole('button', { name: 'Remover proposta P3' }).click();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();

  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();
});

test('remover primeira proposta e adicionar reutiliza primeiro ID livre com estado isolado', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'proposal-id');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await preencherProposta(page, 2, 'Santander', '27000000');

  await page.getByRole('textbox', { name: 'Prazo (meses)' }).first().fill('-');
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeDisabled();
  await page.getByRole('button', { name: 'Remover proposta P1' }).click();
  await expect(page.getByRole('button', { name: /comparar propostas/i })).toBeEnabled();

  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await expect(page.locator('#p1-bank')).toHaveValue('');
  await expect(page.locator('#p2-bank')).toHaveValue('Itaú');
  await expect(page.locator('#p3-bank')).toHaveValue('Santander');
  await expect(page.getByText('Proposta P1', { exact: true })).toBeVisible();

  await preencherProposta(page, 2, 'Bradesco', '26000000');
  await expect(page.locator('#p3-bank')).toHaveValue('Santander');
  await expect(page.locator('#p1-bank')).toHaveValue('Bradesco');
  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
});

test('após carregar comparação salva reutiliza primeiro ID livre ao remover primeira e intermediária', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = await cadastrar(page, 'saved-proposal-id');
  await assinar(page, email);
  await page.goto('/comparar-propostas');
  await page.getByRole('textbox', { name: /Quanto consegue pagar por mês/ }).fill('1200000');
  await preencherProposta(page, 0, 'Caixa', '25000000');
  await preencherProposta(page, 1, 'Itaú', '23000000');
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await preencherProposta(page, 2, 'Santander', '27000000');
  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/comparação salva automaticamente/i)).toBeVisible({ timeout: 15000 });
  await page.goto('/minhas-simulacoes');
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.waitForURL(/id=/);
  await page.reload();

  await page.getByRole('button', { name: 'Remover proposta P1' }).click();
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await page.locator('#p1-bank').fill('Bradesco');
  await expect(page.locator('#p2-bank')).toHaveValue('Itaú');
  await expect(page.locator('#p3-bank')).toHaveValue('Santander');

  await page.getByRole('button', { name: 'Remover proposta P2' }).click();
  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await page.locator('#p2-bank').fill('Inter');
  await expect(page.locator('#p1-bank')).toHaveValue('Bradesco');
  await expect(page.locator('#p3-bank')).toHaveValue('Santander');
  await expect(page.locator('[id$="-bank"]')).toHaveCount(3);
});
