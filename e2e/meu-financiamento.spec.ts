import { execSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { todayISO } from '../src/lib/meu-financiamento/dates';
import type { ContractParams, ParcelaPaga } from '../src/lib/finance/meu-financiamento/model';
import { projecao } from '../src/lib/finance/meu-financiamento/model';

// Contrato padrão dos testes: Caixa PRICE 10,5% a.a., TR 0,17%, seguro R$ 100,
// 360 parcelas, próxima 141, saldo R$ 1.000.000. Oráculo do modelo puro.
const PARAMS_E2E: ContractParams = {
  bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, parcelasTotais: 360,
};

// Banco local do repo (docker 5433). Mesmo padrão de e2e/comparator.spec.ts:
// só os testes que tocam o banco via psql pulam quando o cliente não existe.
const DB_URL = 'postgres://postgres:postgres@localhost:5433/financiamento';
const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function psql(query: string): string {
  return execSync(`psql "${DB_URL}" -t -A -c "${query}"`).toString().trim();
}

function parseBRL(text: string): number {
  const match = text.match(/R\$\s*([\d.,]+)|(\d{1,3}(?:\.\d{3})+,\d{2})/);
  if (!match) throw new Error(`sem valor em reais no texto: ${text}`);
  return Number((match[1] ?? match[2]).replace(/\./g, '').replace(',', '.'));
}

function centsOf(value: number): string {
  return String(Math.round(value * 100));
}

function parcelaNumeroDaQuitacao(text: string): number {
  const match = text.match(/Parcela (\d+)/);
  if (!match) throw new Error(`sem parcela de quitação no texto: ${text}`);
  return Number(match[1]);
}

const saldoCard = (page: Page): Locator =>
  page.getByText('Saldo devedor atual', { exact: true }).locator('..');
const proximaCard = (page: Page): Locator =>
  page.getByText('Próxima parcela', { exact: true }).locator('..');
const quitacaoCard = (page: Page): Locator =>
  page.getByText('Quitação estimada', { exact: true }).locator('..');

async function criarConta(page: Page, nome: string): Promise<{ id: string; email: string }> {
  const email = `mf9-${crypto.randomUUID()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill(nome);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  const signup = page.waitForResponse(
    (response) => response.url().endsWith('/api/signup') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  const response = await signup;
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: string };
  await page.waitForURL(/nova-simulacao/);
  return { id, email };
}

async function assinar(page: Page, userId: string) {
  const upgrade = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${userId}&packId=unlimited`,
  );
  expect(upgrade.ok()).toBe(true);
}

// Contrato usado pelos fluxos: Caixa, PRICE, 10,5% a.a. efetiva, TR 0,17% a.m.,
// seguro R$ 100, 360 parcelas, próxima 141, saldo R$ 1.000.000, data-base hoje.
async function preencherWizard(page: Page, hoje: string) {
  await page.goto('/meu-financiamento');
  await expect(page.getByText('Passo 1 de 4')).toBeVisible({ timeout: 60_000 });
  await page.locator('#bank').fill('Caixa');
  await page.locator('#annualRate').fill('10,5');
  await page.locator('#trMonthly').fill('0,17');
  await page.locator('#insuranceMonthly').fill('10000');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();
  await page.locator('#parcelasTotais').fill('360');
  await page.locator('#proximaParcelaNumero').fill('141');
  await page.locator('#saldoDevedor').fill('100000000');
  await page.locator('#dataBase').fill(hoje);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 3 de 4')).toBeVisible();
}

async function criarContrato(page: Page, hoje: string) {
  await preencherWizard(page, hoje);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  await page.getByRole('button', { name: 'Criar meu financiamento', exact: true }).click();
  await expect(page.getByText('Saldo devedor atual', { exact: true })).toBeVisible({ timeout: 30_000 });
}

function baselineDeHoje() {
  return { version: 1, saldoDevedor: 1000000, dataBase: todayISO(), proximaParcelaNumero: 141 };
}

/** Marca a próxima parcela pendente como paga; devolve o valor sugerido usado. */async function pagarProxima(page: Page, extraReais = 0): Promise<number> {
  await page.getByRole('button', { name: 'Paguei', exact: true }).click();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  const sugestao = parseBRL(await box.getByText(/Valor sugerido da parcela projetada/).innerText());
  if (extraReais > 0) {
    await box.locator('#payValor').fill(centsOf(sugestao + extraReais));
  }
  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });
  return sugestao;
}

test('onboarding salva rascunho e continua após reload', async ({ page }) => {
  await criarConta(page, 'Onboarding');
  await page.goto('/meu-financiamento');
  await expect(page.getByText('Passo 1 de 4')).toBeVisible({ timeout: 60_000 });

  await page.locator('#bank').fill('Caixa');
  await page.locator('#annualRate').fill('10,5');
  await page.locator('#trMonthly').fill('0,17');
  await page.locator('#insuranceMonthly').fill('10000');
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
  await expect(page.getByText('Rascunho salvo', { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByText('Passo 1 de 4')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#bank')).toHaveValue('Caixa');
  await expect(page.locator('#annualRate')).toHaveValue('10.5');
  await expect(page.locator('#trMonthly')).toHaveValue('0.17');
  await expect(page.locator('#insuranceMonthly')).toHaveValue(/R\$\s*100,00/);

  // Avança até a conferência e recarrega: o rascunho também persiste o passo
  // (retomada na etapa em que parou), sem exigir assinatura.
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();
  await page.locator('#parcelasTotais').fill('360');
  await page.locator('#proximaParcelaNumero').fill('141');
  await page.locator('#saldoDevedor').fill('100000000');
  await page.locator('#dataBase').fill(todayISO());
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 3 de 4')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Passo 3 de 4')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Parcela estimada da parcela 141', { exact: true })).toBeVisible();
});

test('criação exige Ilimitado: wizard completo mostra UpgradeCard sem contrato', async ({ page }) => {
  const conta = await criarConta(page, 'Paywall Criação');
  await preencherWizard(page, todayISO());

  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  await page.getByRole('button', { name: 'Criar meu financiamento', exact: true }).click();
  await expect(page.getByText('Crie seu financiamento com o plano Ilimitado')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Assinar Ilimitado/ })).toBeVisible();
  await expect(page.getByText('Saldo devedor atual', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Resumo', exact: true })).toHaveCount(0);

  if (hasPsql) {
    const count = psql(
      `select count(*) from contracts c join users u on u.id = c.user_id where u.email = '${conta.email}'`,
    );
    expect(count).toBe('0');
  }
});

test('fluxo completo do assinante cria o contrato e mostra o dashboard', async ({ page }) => {
  const conta = await criarConta(page, 'Fluxo Completo');
  await assinar(page, conta.id);
  const hoje = todayISO();
  await criarContrato(page, hoje);

  await expect(page.locator('main').getByText('Plano Ilimitado', { exact: true })).toBeVisible();
  await expect(saldoCard(page)).toContainText(/R\$\s*1\.000\.000,00/);
  await expect(proximaCard(page)).toContainText('Parcela 141 de 360');
  await expect(proximaCard(page)).toContainText(/R\$\s*[\d.,]+/);
  await expect(page.getByRole('heading', { name: 'Próximos boletos', exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma parcela paga ainda.', { exact: true })).toBeVisible();
});

test('marcar boleto com o valor sugerido move a próxima parcela e o saldo segue o modelo', async ({ page }) => {
  const conta = await criarConta(page, 'Marcar Boleto');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const saldoAntes = parseBRL(await saldoCard(page).innerText());
  const paga = await pagarProxima(page);

  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  const saldoDepois = parseBRL(await saldoCard(page).innerText());
  // Oráculo: o saldo pós-pagamento é o do modelo encadeado (a parcela do PRICE
  // com TR por fora não cobre a correção no primeiro mês, então o saldo pode
  // SUBIR levemente; a verdade do banco vem da recalibração pelo extrato).
  const esperado = projecao(PARAMS_E2E, baselineDeHoje(), [
    { parcelaNumero: 141, valor: paga, dataPagamento: todayISO() },
  ], []).saldoEfetivo;
  expect(saldoDepois).toBeCloseTo(esperado, 2);
  expect(paga).toBeGreaterThan(0);

  const linhaPaga = page.getByRole('row').filter({ has: page.getByText('141', { exact: true }) });
  await expect(linhaPaga).toHaveCount(1);
  await expect(linhaPaga).toContainText(/R\$\s*[\d.,]+/);
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
  void saldoAntes;
});

test('pagamento divergente sugere recalibração e o banner some após recalibrar', async ({ page }) => {
  const conta = await criarConta(page, 'Divergência');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Parcela 142 com R$ 500 além do projetado: o modelo diverge do extrato.
  await pagarProxima(page, 500);
  await expect(proximaCard(page)).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  await expect(page.getByText(/divergem do modelo/)).toBeVisible({ timeout: 20_000 });
  const saldoDivergente = parseBRL(await saldoCard(page).innerText());

  await page.getByRole('button', { name: 'Recalibrar saldo', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#recData')).toHaveValue(todayISO());
  await expect(dialog.locator('#recParcela')).toHaveValue('143');
  // O extrato do banco: o próprio saldo efetivo do modelo após os pagamentos
  // (os R$ 500 a mais já abateram o principal no modelo).
  await expect(parseBRL(await dialog.locator('#recSaldo').inputValue())).toBeCloseTo(saldoDivergente, 2);
  await dialog.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0, { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  // espera o refresh refletir o saldo recalibrado (R$ 500 a mais já abateram
  // o principal no modelo; o extrato informado foi o próprio saldo efetivo)
  await expect
    .poll(async () => parseBRL(await saldoCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(saldoDivergente, 2);
  await expect(page.getByText('Nenhuma parcela paga ainda.', { exact: true })).toBeVisible();
});

test('amortização extra modo term encurta a quitação e aparece no histórico', async ({ page }) => {
  const conta = await criarConta(page, 'Amortização Extra');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const quitacaoAntes = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  expect(quitacaoAntes).toBe(360);

  await page.getByRole('button', { name: 'Registrei amortização', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#amortValor').fill('10000000');
  await dialog.locator('#amortData').fill(todayISO());
  await dialog.getByRole('button', { name: 'Confirmar amortização', exact: true }).click();

  // Espera o refresh refletir a amortização no histórico ANTES de ler a
  // quitação (o banner de divergência não existe neste fluxo, então o count-0
  // não sincroniza com o router.refresh).
  const secao = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Amortizações extras' }) });
  await expect(secao).toContainText('Dinheiro próprio', { timeout: 20_000 });
  await expect(secao).toContainText('Reduziu o prazo (parcela igual)');
  await expect(secao).toContainText(/R\$\s*100\.000,00/);

  const quitacaoDepois = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  // Oráculo do modelo: saldo R$ 900.000 com a parcela do cronograma encurta
  // para 170 parcelas → quitação na parcela 310.
  expect(quitacaoDepois).toBe(310);
});

test('expiração do plano congela a leitura e mostra o paywall sem ações', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const conta = await criarConta(page, 'Expiração');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());
  await expect(page.getByRole('button', { name: 'Paguei', exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('Plano Ilimitado', { exact: true })).toBeVisible();
  const saldoAntes = parseBRL(await saldoCard(page).innerText());

  psql(
    `update subscriptions set current_period_end = now() - interval '1 day' where user_id = '${conta.id}'`,
  );
  await page.reload();

  await expect(page.getByText('Saldo devedor atual', { exact: true })).toBeVisible({ timeout: 60_000 });
  expect(parseBRL(await saldoCard(page).innerText())).toBeCloseTo(saldoAntes, 2);
  await expect(page.getByText('Próximos boletos', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma parcela paga ainda.', { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('Plano Ilimitado', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Registre boletos pagos, amortizações extras e recalibre o saldo pelo extrato do banco.', {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Ver opções de acesso', exact: true })).toBeVisible();

  for (const name of [
    'Paguei',
    'Confirmar pagamento',
    'Registrei amortização',
    'Confirmar amortização',
    'Recalibrar saldo',
    'Confirmar recalibração',
    'Editar',
    'Apagar',
    'Salvar',
    'Cancelar',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: 'Recomendações', exact: true })).toHaveCount(0);
});

test('correção: apagar o pagamento da parcela 141 devolve a próxima parcela para 141', async ({ page }) => {
  const conta = await criarConta(page, 'Correção');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const saldoOriginal = parseBRL(await saldoCard(page).innerText());
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Corrige o valor da parcela registrada (linha de edição inline fica aberta
  // após o refresh do Salvar) e depois fecha com Cancelar antes de apagar.
  const linhaPaga = page.getByRole('row').filter({ has: page.getByText('141', { exact: true }) });
  await linhaPaga.getByRole('button', { name: 'Editar', exact: true }).click();
  const valorEditado = page.locator('input[id^="editarValor-"]');
  await expect(valorEditado).toBeVisible();
  const atual = parseBRL(await valorEditado.inputValue());
  await valorEditado.fill(centsOf(atual + 100));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('input[id^="editarValor-"]')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('input[id^="editarValor-"]')).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  await linhaPaga.getByRole('button', { name: 'Apagar', exact: true }).click();

  await expect(proximaCard(page)).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  expect(parseBRL(await saldoCard(page).innerText())).toBeCloseTo(saldoOriginal, 2);
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
  await expect(page.getByText('Nenhuma parcela paga ainda.', { exact: true })).toBeVisible();
});
