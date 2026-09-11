import { execSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { todayISO } from '../src/lib/meu-financiamento/dates';
import type { ContractParams } from '../src/lib/finance/meu-financiamento/model';
import { projecao } from '../src/lib/finance/meu-financiamento/model';
import { formatBRL } from '../src/lib/utils';

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
const totalCard = (page: Page): Locator =>
  page.getByText('Total pago', { exact: true }).locator('..');
const quitacaoCard = (page: Page): Locator =>
  page.getByText('Quitação estimada', { exact: true }).locator('..');
const economiaCard = (page: Page): Locator =>
  page.getByText('Economizado com amortizações', { exact: true }).locator('..');

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
  await page.locator('#diaVencimento').fill('10');
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

// O card do mês alterna o título quando o vencimento estimado (dia 10 no
// contrato padrão) já passou; mantém o assert exato em qualquer data.
const TITULO_CARD_MES = Number(todayISO().slice(8, 10)) > 10 ? 'Parcela em aberto' : 'Sua parcela deste mês';

function amanhaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// O banner de estado expõe "Recalibrar saldo" quando visível; os fluxos de
// teste clicam o CTA do banner (o botão "Recalibrar pelo extrato" fica na faixa
// de ações do topo).
const recalibrarNoBanner = (page: Page): Locator =>
  page.locator('[data-state-banner]').getByRole('button', { name: 'Recalibrar saldo', exact: true });

/** Marca a próxima parcela pendente como paga; devolve o valor sugerido usado. */
async function pagarProxima(page: Page, extraReais = 0): Promise<number> {
  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  const sugestao = parseBRL(await box.getByText(/Valor sugerido da parcela projetada/).innerText());
  if (extraReais !== 0) {
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
  await page.locator('#diaVencimento').fill('10');
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
  await expect(page.getByRole('heading', { name: 'Histórico', exact: true })).toHaveCount(0);

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
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360');
  await expect(page.getByRole('heading', { name: 'Histórico', exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();

  // O dia do vencimento informado no wizard (10) vale para a tabela de parcelas.
  await page.getByText('Parcelas do Financiamento', { exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Vencimento' })).toBeVisible();
  const primeira = page.locator('tr[data-numero="141"]');
  await expect(primeira).toBeVisible();
  await expect(primeira).toContainText('10/');
  await expect(primeira).toContainText('Em aberto');
});

test('tabela "Parcelas do Financiamento" lista o cronograma e carrega mais 24 por vez', async ({ page }) => {
  const conta = await criarConta(page, 'Parcelas do Financiamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const resumo = page.getByText('Parcelas do Financiamento', { exact: true });
  await expect(resumo).toBeVisible();
  // Fechado por padrão: as linhas existem no DOM (details), mas ocultas.
  await expect(page.locator('tr[data-numero="141"]')).toBeHidden();

  await resumo.click();
  await expect(page.locator('tr[data-numero="141"]')).toBeVisible();
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Em aberto');
  // 24 linhas por vez: a 164 fecha o primeiro bloco, a 165 só com "Mostrar mais".
  await expect(page.locator('tr[data-numero="164"]')).toBeVisible();
  await expect(page.locator('tr[data-numero="165"]')).toHaveCount(0);
  await expect(page.getByText('Em aberto').first()).toBeVisible();

  await page.getByRole('button', { name: 'Mostrar mais', exact: true }).click();
  await expect(page.locator('tr[data-numero="165"]')).toBeVisible();

  // Pagar a 141 reescreve a linha como "Paga" com a composição do encadeamento
  // do model (juros, correção, seguro e amortização) do valor real pago.
  const paga = await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  // O refresh pode manter o details aberto ou fechá-lo; abre só se preciso.
  const linhaPaga = page.locator('tr[data-numero="141"]');
  if (!(await linhaPaga.isVisible())) await resumo.click();
  await expect(linhaPaga).toContainText('Paga');
  const pg = projecao(PARAMS_E2E, baselineDeHoje(), [
    { parcelaNumero: 141, valor: paga, dataPagamento: todayISO() },
  ], []).pagas[0];
  await expect(linhaPaga).toContainText(formatBRL(pg.juros));
  await expect(linhaPaga).toContainText(formatBRL(pg.correcao));
  await expect(linhaPaga).toContainText(formatBRL(pg.seguro));
  await expect(linhaPaga).toContainText(formatBRL(pg.amortizacao));
  // Sem extras no estado, o Saldo da paga é o do encadeamento sem extras.
  await expect(linhaPaga.locator('[data-cell="saldo"]')).toHaveText(formatBRL(pg.saldo));

  // Com amortização extra no estado vigente até a data da paga, o saldo do
  // encadeamento sem extras deixa de representar o saldo real: vira "—" (a
  // composição juros/correção/seguro/amortização segue inalterada).
  const valorExtra = 100000;
  await page.getByRole('button', { name: 'Registrar amortização extra', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#amortValor').fill(centsOf(valorExtra));
  await dialog.locator('#amortData').fill(todayISO());
  await dialog.getByRole('button', { name: 'Confirmar amortização', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  if (!(await linhaPaga.isVisible())) await resumo.click();
  await expect(linhaPaga.locator('[data-cell="saldo"]')).toHaveText('—');
  await expect(linhaPaga).toContainText(formatBRL(pg.juros));
  await expect(linhaPaga).toContainText(formatBRL(pg.amortizacao));
});

test('sugestão de amortização aplica ideal, meia e extra com a economia calculada', async ({ page }) => {
  const conta = await criarConta(page, 'Sugestão de Amortização');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const quitacaoAntes = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  expect(quitacaoAntes).toBe(360);

  await page.getByText('Quer amortizar junto?', { exact: true }).click();
  await expect(page.getByText('Ideal calculado', { exact: true })).toBeVisible();
  await expect(page.getByText('Meia parcela', { exact: true })).toBeVisible();
  await expect(page.getByText('Parcela extra', { exact: true })).toBeVisible();

  // Ideal calculado: menor aporte que corta 1 parcela; a quitação cai
  // EXATAMENTE 1 e o split do form recebe o aporte exibido.
  const cardIdeal = page.locator('[data-opcao="ideal"]');
  await expect(cardIdeal).toContainText('Economia total de R$');
  await expect(cardIdeal).toContainText(/elimina 1 parcela \(R\$\s*[\d.,]+\)/);
  expect(parseBRL(await cardIdeal.getByText(/Economia total de/).innerText())).toBeGreaterThan(0);
  const ideal = parseBRL(await cardIdeal.innerText());
  expect(ideal).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Aplicar ideal', exact: true }).click();

  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  await expect(box.getByText(/Parcela .* \+ amortização extra/)).toBeVisible();
  await expect(box.getByText('Reduziu o prazo (parcela igual)', { exact: true })).toBeVisible();
  expect(parseBRL(await box.locator('strong').last().innerText())).toBeCloseTo(ideal, 1);

  // Modo "Reduziu a parcela" avisa que o prazo não encurta; voltar para o
  // term restaura o default da sugestão.
  await box.getByRole('radio', { name: 'Reduziu a parcela (prazo igual)' }).click();
  await expect(
    box.getByText("No modo 'reduzir a parcela' o prazo não encurta; a economia vem da parcela menor."),
  ).toBeVisible();
  await box.getByRole('radio', { name: 'Reduziu o prazo (parcela igual)' }).click();
  await expect(box.getByText(/No modo 'reduzir a parcela'/)).toHaveCount(0);

  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });
  await expect
    .poll(async () => parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText()), { timeout: 20_000 })
    .toBe(quitacaoAntes - 1);

  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico).toContainText('Amortização extra', { timeout: 20_000 });
  await expect(historico).toContainText(/Parcela 141 ·/);
  // O valor REGISTRADO da amortização é exatamente o aporte exibido no card
  // (aporte explícito no servidor), não alguns reais a menos.
  const eventoAmortizacao = historico.getByText(/Amortização extra de/).first();
  await expect(eventoAmortizacao).toBeVisible();
  expect(parseBRL(await eventoAmortizacao.innerText())).toBeCloseTo(ideal, 2);

  // Tabela de parcelas: a amortização (data de hoje, igual ao vencimento
  // estimado da 141) aparece intercalada entre as parcelas 141 e 142, com
  // origem e modo.
  await page.getByText('Parcelas do Financiamento', { exact: true }).click();
  const linhas = page.locator('details table tbody tr');
  const textos = await linhas.allInnerTexts();
  const amortizacao = textos.findIndex((t) => t.includes('Amortização extra de'));
  const parcela141 = textos.findIndex((t) => t.startsWith('141'));
  const parcela142 = textos.findIndex((t) => t.startsWith('142'));
  expect(parcela141).toBeGreaterThanOrEqual(0);
  expect(amortizacao).toBeGreaterThan(parcela141);
  expect(amortizacao).toBeLessThan(parcela142);
  expect(textos[amortizacao]).toContain('Dinheiro próprio');
  expect(textos[amortizacao]).toContain('Reduziu o prazo');
  expect(textos[amortizacao]).toMatch(/\d{2}\/\d{2}\/\d{4}/);

  // Meia parcela: economia exibida, efeito no prazo e aporte aplicado no split.
  const cardMeia = page.locator('[data-opcao="meia"]');
  await expect(cardMeia).toContainText('Economia total de R$');
  await expect(cardMeia).toContainText(/elimina \d+ parcela|não reduz o prazo/);
  expect(parseBRL(await cardMeia.getByText(/Economia total de/).innerText())).toBeGreaterThan(0);
  const meia = parseBRL(await cardMeia.innerText());
  await page.getByRole('button', { name: 'Aplicar meia parcela', exact: true }).click();
  const boxMeia = page.locator('[data-pay-installment]');
  await expect(boxMeia).toBeVisible();
  expect(parseBRL(await boxMeia.locator('strong').last().innerText())).toBeCloseTo(meia, 1);
  await boxMeia.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(boxMeia).toHaveCount(0);

  // Parcela extra: economia exibida, efeito no prazo, aplica e a quitação não piora.
  const quitacaoAntesExtra = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  const cardExtra = page.locator('[data-opcao="extra"]');
  await expect(cardExtra).toContainText('Economia total de R$');
  await expect(cardExtra).toContainText(/elimina \d+ parcela|não reduz o prazo/);
  expect(parseBRL(await cardExtra.getByText(/Economia total de/).innerText())).toBeGreaterThan(0);
  const extra = parseBRL(await cardExtra.innerText());
  await page.getByRole('button', { name: 'Aplicar parcela extra', exact: true }).click();
  const boxExtra = page.locator('[data-pay-installment]');
  await expect(boxExtra).toBeVisible();
  expect(parseBRL(await boxExtra.locator('strong').last().innerText())).toBeCloseTo(extra, 1);
  await boxExtra.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(boxExtra).toHaveCount(0, { timeout: 20_000 });
  // O mesmo caminho de aporte explícito vale para meia/extra: a amortização
  // registrada é o valor exibido (busca entre os eventos do período, sem
  // depender da ordem).
  await expect
    .poll(
      async () =>
        (await historico.getByText(/Amortização extra de/).allInnerTexts())
          .map(parseBRL)
          .some((v) => Math.abs(v - extra) < 0.005),
      { timeout: 20_000 },
    )
    .toBe(true);
  await expect
    .poll(async () => parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText()), { timeout: 20_000 })
    .toBeLessThanOrEqual(quitacaoAntesExtra);
});

test('marcar boleto com o valor sugerido move a próxima parcela e o saldo segue o modelo', async ({ page }) => {
  const conta = await criarConta(page, 'Marcar Boleto');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

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

  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico.getByText(/Parcela 141 ·/)).toBeVisible();
  await expect(historico.getByText(/R\$\s*[\d.,]+/).first()).toBeVisible();
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
});

test('pagamento divergente sugere recalibração e o banner some após recalibrar', async ({ page }) => {
  const conta = await criarConta(page, 'Divergência');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Parcela 142 com R$ 500 A MENOS que o projetado: pagamento parcial, o
  // modelo diverge do extrato.
  await pagarProxima(page, -500);
  await expect(proximaCard(page)).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  await expect(page.getByText(/divergem do modelo/)).toBeVisible({ timeout: 20_000 });
  const saldoDivergente = parseBRL(await saldoCard(page).innerText());

  await recalibrarNoBanner(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#recData')).toHaveValue(todayISO());
  await expect(dialog.locator('#recParcela')).toHaveValue('143');
  // O extrato do banco: o próprio saldo efetivo do modelo após os pagamentos
  // (o parcial de R$ 500 a menos já deixou o principal maior no modelo).
  await expect(parseBRL(await dialog.locator('#recSaldo').inputValue())).toBeCloseTo(saldoDivergente, 2);
  await dialog.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0, { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  // espera o refresh refletir o saldo recalibrado (o extrato informado foi o
  // próprio saldo efetivo do modelo após o pagamento parcial)
  await expect
    .poll(async () => parseBRL(await saldoCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(saldoDivergente, 2);
  // A recalibração vira marco na timeline; os lançamentos do baseline
  // superado continuam visíveis no grupo do período anterior.
  await expect(page.getByText(/Saldo recalibrado pelo extrato/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toHaveCount(0);
});

test('excedente do pagamento vira amortização extra vinculada e desfazer apaga o grupo', async ({ page }) => {
  const conta = await criarConta(page, 'Excedente do Pagamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  const sugestao = parseBRL(await box.getByText(/Valor sugerido da parcela projetada/).innerText());
  await box.locator('#payValor').fill(centsOf(sugestao + 500));

  // Split em tempo real: parcela + amortização extra, modo default e nota.
  await expect(box.getByText(/Parcela .* \+ amortização extra/)).toBeVisible();
  await expect(box.getByText('Reduziu o prazo (parcela igual)', { exact: true })).toBeVisible();
  await expect(box.getByText(/O excedente será registrado como amortização extra/)).toBeVisible();

  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });

  // Excedente vira amortização: sem banner de divergência e com os dois
  // eventos na timeline.
  await expect(page.getByText(/Parcela 141 paga em/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);

  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico).toContainText('Amortização extra', { timeout: 20_000 });
  await expect(historico).toContainText('Dinheiro próprio');
  await expect(historico).toContainText('Reduziu o prazo (parcela igual)');
  await expect(historico).toContainText(/R\$\s*500,00/);
  await expect(historico).toContainText(/Parcela 141 ·/);

  // Desfazer a parcela apaga o grupo inteiro (parcela + amortização extra).
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();

  await expect(page.getByText(/Parcela 141 paga em/)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: TITULO_CARD_MES, exact: true })).toBeVisible();
  await expect(historico).not.toContainText('Amortização extra');
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();
});

test('amortização extra modo term encurta a quitação e aparece no histórico', async ({ page }) => {
  const conta = await criarConta(page, 'Amortização Extra');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const quitacaoAntes = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  expect(quitacaoAntes).toBe(360);

  // Valores relativos ao saldo: 0,01% fica abaixo do mínimo que corta 1
  // parcela; 20% corta várias. Exercita os dois ramos do preview.
  const saldoInicial = parseBRL(await saldoCard(page).innerText());
  const valorPequeno = Math.round(saldoInicial * 0.0001);
  const valorGrande = Math.round(saldoInicial * 0.2);

  await page.getByRole('button', { name: 'Registrar amortização extra', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#amortValor').fill(centsOf(valorPequeno));
  await expect(dialog.locator('[data-efeito-aporte]')).toContainText('não reduz o prazo');
  await dialog.locator('#amortValor').fill(centsOf(valorGrande));
  await expect(dialog.locator('[data-efeito-aporte]')).toContainText(/elimina \d+ parcela/);
  // Modo payment: o prazo não muda e o preview estima a parcela seguinte (mês 2
  // da engine); voltar ao term restaura o efeito no prazo.
  await dialog.getByRole('radio', { name: 'Reduziu a parcela (prazo igual)' }).click();
  await expect(dialog.locator('[data-efeito-aporte]')).toContainText('não reduz o prazo');
  await expect(dialog.locator('[data-efeito-aporte]')).toContainText('Parcela estimada:');
  await dialog.getByRole('radio', { name: 'Reduziu o prazo (parcela igual)' }).click();
  await expect(dialog.locator('[data-efeito-aporte]')).toContainText(/elimina \d+ parcela/);
  await dialog.locator('#amortData').fill(todayISO());
  await dialog.getByRole('button', { name: 'Confirmar amortização', exact: true }).click();

  // Espera o refresh refletir a amortização no histórico ANTES de ler a
  // quitação (o banner de divergência não existe neste fluxo, então o count-0
  // não sincroniza com o router.refresh).
  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico).toContainText('Amortização extra', { timeout: 20_000 });
  await expect(historico).toContainText('Dinheiro próprio');
  await expect(historico).toContainText('Reduziu o prazo (parcela igual)');
  await expect(historico).toContainText(formatBRL(valorGrande));

  // Hero: a amortização liga a micro-métrica de economia (antes mostrava "—").
  await expect(economiaCard(page)).toContainText(/R\$\s*[\d.,]+/);
  expect(parseBRL(await economiaCard(page).innerText())).toBeGreaterThan(0);

  const quitacaoDepois = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  // Oráculo do modelo: a mesma amortização no modelo puro deriva a parcela de
  // quitação — o número cravado viraria manutenção silenciosa se a engine mudar.
  const oracle = projecao(PARAMS_E2E, baselineDeHoje(), [], [
    { dataPagamento: todayISO(), valor: valorGrande, origem: 'proprio', modo: 'term' },
  ]);
  expect(quitacaoDepois).toBe(oracle.quitaEm);
});

test('expiração do plano congela a leitura e mostra o paywall sem ações', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const conta = await criarConta(page, 'Expiração');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());
  await expect(page.getByRole('button', { name: 'Paguei esta parcela', exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('Plano Ilimitado', { exact: true })).toBeVisible();
  const saldoAntes = parseBRL(await saldoCard(page).innerText());

  psql(
    `update subscriptions set current_period_end = now() - interval '1 day' where user_id = '${conta.id}'`,
  );
  await page.reload();

  await expect(page.getByText('Saldo devedor atual', { exact: true })).toBeVisible({ timeout: 60_000 });
  expect(parseBRL(await saldoCard(page).innerText())).toBeCloseTo(saldoAntes, 2);
  await expect(page.getByRole('heading', { name: 'Histórico', exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('Plano Ilimitado', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Registre boletos pagos, amortizações extras e recalibre o saldo pelo extrato do banco.', {
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Ver opções de acesso', exact: true })).toBeVisible();

  for (const name of [
    'Paguei esta parcela',
    'Confirmar pagamento',
    'Registrar amortização extra',
    'Confirmar amortização',
    'Editar contrato',
    'Salvar alterações',
    'Recalibrar saldo',
    'Recalibrar pelo extrato',
    'Confirmar recalibração',
    'Desfazer',
    'Editar',
    'Apagar',
    'Salvar',
    'Cancelar',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: 'Recomendações', exact: true })).toHaveCount(0);
  await expect(page.getByText('Quer amortizar junto?', { exact: true })).toHaveCount(0);
});

test('correção: apagar o pagamento da parcela 141 devolve a próxima parcela para 141', async ({ page }) => {
  const conta = await criarConta(page, 'Correção');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const saldoOriginal = parseBRL(await saldoCard(page).innerText());
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Corrige o valor da parcela registrada (painel de edição inline fica aberto
  // após o refresh do Salvar) e depois fecha com Cancelar antes de apagar.
  await page.getByRole('button', { name: 'Editar parcela 141', exact: true }).click();
  const valorEditado = page.locator('input[id^="editarValor-"]');
  await expect(valorEditado).toBeVisible();
  const atual = parseBRL(await valorEditado.inputValue());
  await valorEditado.fill(centsOf(atual + 100));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.locator('input[id^="editarValor-"]')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('input[id^="editarValor-"]')).toHaveCount(0);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Apagar parcela 141', exact: true }).click();

  await expect(proximaCard(page)).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  expect(parseBRL(await saldoCard(page).innerText())).toBeCloseTo(saldoOriginal, 2);
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();
});

test('desfazer o pagamento pelo card volta a parcela 141 e limpa a timeline', async ({ page }) => {
  const conta = await criarConta(page, 'Desfazer Pagamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await pagarProxima(page);
  await expect(page.getByText(/Parcela 141 paga em/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();

  // O refresh apaga a confirmação, devolve a parcela 141 para o card e zera a
  // timeline (só o cadastro restava, e ele não conta como lançamento).
  await expect(page.getByText(/Parcela 141 paga em/)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: TITULO_CARD_MES, exact: true })).toBeVisible();
  await expect(page.getByText(/Parcela 141 ·/)).toHaveCount(0);
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();
});

test('amortização do saldo inteiro zera o modelo, mostra o aviso âmbar e recalibrar restaura', async ({ page }) => {
  const conta = await criarConta(page, 'Zero por Lançamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());
  await expect(page.getByText('Financiamento quitado', { exact: true })).toHaveCount(0);

  // Lançamento equivocado: amortização pelo saldo devedor inteiro. O contrato
  // segue ativo no banco (baseline R$ 1.000.000), só o MODELO zera.
  await page.getByRole('button', { name: 'Registrar amortização extra', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#amortValor').fill('100000000');
  await dialog.locator('#amortData').fill(todayISO());
  await dialog.getByRole('button', { name: 'Confirmar amortização', exact: true }).click();

  await expect(page.getByText(/zeraram o saldo no modelo/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Financiamento quitado', { exact: true })).toHaveCount(0);
  await expect(recalibrarNoBanner(page)).toBeVisible();

  // Extrato do banco mostra R$ 990.000: recalibra e o modelo volta a projetar.
  await recalibrarNoBanner(page).click();
  const rec = page.getByRole('dialog');
  await expect(rec).toBeVisible();
  await expect(rec.locator('#recParcela')).toHaveValue('141');
  await rec.locator('#recSaldo').fill('99000000');
  await rec.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  await expect(page.getByText(/zeraram o saldo no modelo/)).toHaveCount(0, { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect
    .poll(async () => parseBRL(await saldoCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(990000, 2);
});

test('recalibração com saldo 0 encerra o contrato e recalibrar de novo reativa o acompanhamento', async ({ page }) => {
  const conta = await criarConta(page, 'Reativar Quitado');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Cria divergência para o banner de recalibração aparecer.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await pagarProxima(page, -500);
  await expect(page.getByText(/divergem do modelo/)).toBeVisible({ timeout: 20_000 });

  // Extrato (equivocado) informa saldo R$ 0: contrato vira quitado no banco.
  await recalibrarNoBanner(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#recSaldo').fill('0');
  await dialog.locator('#recData').fill(todayISO());
  await expect(dialog.locator('#recParcela')).toHaveValue('143');
  await dialog.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  await expect(
    page.locator('[data-state-banner]').getByText('Financiamento quitado', { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
  await expect(recalibrarNoBanner(page)).toBeVisible();

  // O extrato certo mostra R$ 500.000: a mesma recalibração reativa o contrato
  // com uma versão nova (source 'recalibracao'), sem perder o histórico.
  await recalibrarNoBanner(page).click();
  const rec = page.getByRole('dialog');
  await expect(rec).toBeVisible();
  await expect(rec.locator('#recParcela')).toHaveValue('143');
  await rec.locator('#recSaldo').fill('50000000');
  await rec.locator('#recData').fill(todayISO());
  await rec.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  // O banner some; o marco de quitação permanece na timeline como histórico.
  await expect(
    page.locator('[data-state-banner]').getByText('Financiamento quitado', { exact: true }),
  ).toHaveCount(0, { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  await expect
    .poll(async () => parseBRL(await saldoCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(500000, 2);
  await expect(page.getByRole('button', { name: 'Paguei esta parcela', exact: true })).toBeVisible();
});

test('editar contrato troca banco e taxa, congela o passado e derruba a próxima parcela', async ({ page }) => {
  const conta = await criarConta(page, 'Editar Contrato');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Paga a parcela 141 ANTES de editar: o lançamento vira passado congelado.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  const totalAntes = parseBRL(await totalCard(page).innerText());
  const saldoAntes = parseBRL(await saldoCard(page).innerText());
  const proximaAntes = parseBRL(await proximaCard(page).innerText());
  expect(totalAntes).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Prefill do estado vigente: saldo efetivo, data-base de hoje e parcela 142.
  await expect(dialog.locator('#editBank')).toHaveValue('Caixa');
  await expect(parseBRL(await dialog.locator('#editSaldo').inputValue())).toBeCloseTo(saldoAntes, 2);
  await expect(dialog.locator('#editDataBase')).toHaveValue(todayISO());
  await expect(dialog.locator('#editParcela')).toHaveValue('142');
  await expect(dialog.getByText('A mudança vale da próxima parcela em diante; o histórico anterior não é recalculado.'))
    .toBeVisible();

  await dialog.locator('#editBank').fill('Itaú');
  await dialog.locator('#editAnnualRate').fill('9,8');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });

  // O chip do hero passa a mostrar o banco novo.
  await expect(page.getByText('Itaú · PRICE · Parcela 142 de 360')).toBeVisible({ timeout: 20_000 });
  // Taxa menor derruba a próxima parcela projetada.
  await expect
    .poll(async () => parseBRL(await proximaCard(page).innerText()), { timeout: 20_000 })
    .toBeLessThan(proximaAntes);
  // O passado congelado continua visível: timeline e Total pago preservados.
  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico.getByText(/Contrato atualizado/)).toBeVisible({ timeout: 20_000 });
  await expect(historico.getByText(/Caixa → Itaú/)).toBeVisible();
  await expect(historico.getByText(/Parcela 141 ·/)).toBeVisible();
  // O lançamento anterior à edição fica no período congelado, com o selo e o
  // marco do cadastro; o período vigente é o da atualização.
  const periodoAnterior = historico.locator('li').filter({ hasText: 'período anterior' });
  await expect(periodoAnterior).toContainText('Contrato cadastrado');
  await expect(periodoAnterior).toContainText('Parcela 141 ·');
  await expect
    .poll(async () => parseBRL(await totalCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(totalAntes, 2);
  // Lançamento de estado superado não é editável nem apagável.
  await expect(page.getByRole('button', { name: 'Editar parcela 141', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apagar parcela 141', exact: true })).toHaveCount(0);
});

test('editar contrato aceita parcela anterior à pendente e remove os lançamentos futuros', async ({ page }) => {
  const conta = await criarConta(page, 'Editar Retroativo');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Paga a 141: o lançamento entra no estado vigente.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico.getByText(/Parcela 141 ·/)).toBeVisible();
  const saldoAntes = parseBRL(await saldoCard(page).innerText());

  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#editParcela')).toHaveValue('142');
  await expect(dialog.locator('#editDia')).toHaveValue('10');
  await expect(parseBRL(await dialog.locator('#editSaldo').inputValue())).toBeCloseTo(saldoAntes, 2);

  // Parcela 141, anterior à pendente (142): aviso destrutivo e confirmação
  // explícita obrigatória antes de habilitar o Salvar.
  await dialog.locator('#editParcela').fill('141');
  await expect(
    dialog.getByText(
      'Editar para uma parcela anterior remove os pagamentos e amortizações posteriores deste período do cálculo. Os lançamentos ficam apenas nos estados anteriores do histórico.',
    ),
  ).toBeVisible();
  const salvar = dialog.getByRole('button', { name: 'Salvar alterações', exact: true });
  await expect(salvar).toBeDisabled();
  await dialog.getByLabel('Entendi que os lançamentos posteriores serão removidos').check();
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });

  // A página volta a mostrar a parcela 141; o lançamento do estado superado foi
  // removido (não aparece em lugar nenhum) e a timeline só tem a atualização.
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 141 de 360');
  await expect(historico.getByText(/Contrato atualizado/)).toBeVisible();
  await expect(historico.getByText(/Parcela 141 ·/)).toHaveCount(0);

  // A parcela reaberta pode ser paga de novo, sem colisão no unique.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await expect(historico.getByText(/Parcela 141 ·/)).toBeVisible();
});

test('editar contrato recusa submit quando outra aba muda o estado', async ({ page, context }) => {
  const conta = await criarConta(page, 'Edição Concorrente');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Dialog aberto com o snapshot da pendente 142 (versão vigente).
  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('#editParcela')).toHaveValue('142');

  // Outra aba paga a 142 depois do dialog aberto: o servidor já vê a 143.
  const outra = await context.newPage();
  await outra.goto('/meu-financiamento');
  await expect(outra.locator('[data-month-action]')).toContainText('Parcela 142 de 360', { timeout: 60_000 });
  await pagarProxima(outra);
  await expect(outra.locator('[data-month-action]')).toContainText('Parcela 143 de 360', { timeout: 20_000 });
  await outra.close();

  // Submit com o snapshot velho: recusa e NÃO apaga o pagamento recém-criado.
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog.getByText('O contrato mudou desde que você abriu; reabra e confira os dados')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 143 de 360', { timeout: 30_000 });
  const historico = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Histórico' }) });
  await expect(historico.getByText(/Parcela 142 ·/)).toBeVisible();
});

test('amortização com data futura é recusada sem gravar lançamento', async ({ page }) => {
  const conta = await criarConta(page, 'Data Futura');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await page.getByRole('button', { name: 'Registrar amortização extra', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#amortValor').fill('10000000');
  await dialog.locator('#amortData').fill(amanhaISO());
  await dialog.getByRole('button', { name: 'Confirmar amortização', exact: true }).click();

  await expect(dialog.getByText('Data futura', { exact: true })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByText('Nenhum lançamento ainda.', { exact: true })).toBeVisible();
});
