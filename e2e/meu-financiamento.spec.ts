import { execSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { addMonthsISO, todayISO } from '../src/lib/meu-financiamento/dates';
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
const amortizadoCard = (page: Page): Locator =>
  page.getByText('Amortizado', { exact: true }).locator('..');
const pagamentosCard = (page: Page): Locator =>
  page.getByText('Pagamentos registrados', { exact: true }).locator('..');
const faltaPagarCard = (page: Page): Locator =>
  page.getByText('Falta pagar', { exact: true }).locator('..');
const quitacaoCard = (page: Page): Locator =>
  page.getByText('Quitação estimada', { exact: true }).locator('..');
const economiaCard = (page: Page): Locator =>
  page.getByText('Já economizado', { exact: true }).locator('..');
const amortizadoSituacaoCard = (page: Page): Locator =>
  page.getByText('Amortizado nesta situação', { exact: true }).locator('..');
const economiaSituacaoCard = (page: Page): Locator =>
  page.getByText('Economizado nesta situação', { exact: true }).locator('..');

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

// O banner de estado expõe "Recalibrar saldo" quando visível; os fluxos de
// teste clicam o CTA do banner (o botão "Recalibrar pelo extrato" fica na faixa
// de ações do topo).
const recalibrarNoBanner = (page: Page): Locator =>
  page.locator('[data-state-banner]').getByRole('button', { name: 'Recalibrar saldo', exact: true });

/** Marca a próxima parcela pendente como paga; devolve o valor sugerido usado.
 *  Valida o prefill do vencimento estimado e normaliza para hoje via o atalho
 *  "Definir hoje", mantendo a data do pagamento determinística nos fluxos. */
async function pagarProxima(page: Page, extraReais = 0): Promise<number> {
  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  const titulo = await box.getByText(/Pagamento da parcela \d+/).innerText();
  const parcelaNumero = Number(titulo.match(/\d+/)![0]);
  const vencimento = addMonthsISO(todayISO(), parcelaNumero - 141, 10);
  await expect(box.getByLabel('Data do pagamento')).toHaveValue(vencimento);
  await box.getByRole('button', { name: 'Definir hoje', exact: true }).click();
  await expect(box.getByLabel('Data do pagamento')).toHaveValue(todayISO());
  const sugestao = parseBRL(await box.getByText(/Valor sugerido da parcela projetada/).innerText());
  if (extraReais !== 0) {
    await box.getByLabel('Valor pago (R$)').fill(centsOf(sugestao + extraReais));
  }
  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });
  return sugestao;
}

/** Paga a primeira parcela pendente PELA TABELA (botão "Pagar" da linha em
 *  aberto), preenchendo a seção de amortização extra quando `aporteReais` > 0.
 *  Devolve o valor sugerido da parcela usado. */
async function pagarProximaNaTabela(page: Page, aporteReais = 0): Promise<number> {
  const linha = page.locator('tr[data-situacao="aberta"]').first();
  await linha.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  const titulo = await box.getByText(/Pagamento da parcela \d+/).innerText();
  const parcelaNumero = Number(titulo.match(/\d+/)![0]);
  const vencimento = addMonthsISO(todayISO(), parcelaNumero - 141, 10);
  await expect(box.getByLabel('Data do pagamento')).toHaveValue(vencimento);
  await box.getByRole('button', { name: 'Definir hoje', exact: true }).click();
  await expect(box.getByLabel('Data do pagamento')).toHaveValue(todayISO());
  const sugestao = parseBRL(await box.getByText(/Valor sugerido da parcela projetada/).innerText());
  if (aporteReais !== 0) {
    await box.getByLabel('Amortização extra (R$)').fill(centsOf(aporteReais));
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
  await expect(page.getByRole('heading', { name: 'Parcelas do Financiamento', exact: true })).toHaveCount(0);

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
  await expect(page.getByRole('heading', { name: 'Parcelas do Financiamento', exact: true })).toBeVisible();

  // Seção Contratado vs real: sem amortizações registradas, o gráfico mostra a
  // trajetória atual e convida a amortizar (sem curva contratada para comparar).
  await expect(page.getByRole('heading', { name: 'Contratado vs real', exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Estimativa do modelo a partir do saldo atual. Registre uma amortização extra para comparar o contratado com o real.',
      { exact: true },
    ),
  ).toBeVisible();

  // O dia do vencimento informado no wizard (10) vale para a tabela de parcelas.
  await expect(page.getByRole('columnheader', { name: 'Vencimento' })).toBeVisible();
  const primeira = page.locator('tr[data-numero="141"]');
  await expect(primeira).toBeVisible();
  await expect(primeira).toContainText('10/');
  await expect(primeira).toContainText('Em aberto');
});

test('tabela "Parcelas do Financiamento" lista todas as parcelas e paga a primeira pendente com split', async ({ page }) => {
  const conta = await criarConta(page, 'Parcelas do Financiamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Sem accordion e sem "Mostrar mais": todas as competências ficam no DOM.
  await expect(page.getByRole('heading', { name: 'Parcelas do Financiamento', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mostrar mais', exact: true })).toHaveCount(0);

  const linha141 = page.locator('tr[data-numero="141"]');
  await expect(linha141).toBeVisible();
  await expect(linha141).toContainText('Em aberto');
  await expect(page.locator('tr[data-numero="165"]')).toBeVisible();
  await expect(page.locator('tr[data-numero="360"]')).toBeVisible();
  // O botão "Pagar" existe só na primeira parcela pendente (a 141).
  await expect(page.getByRole('button', { name: 'Pagar', exact: true })).toHaveCount(1);
  await expect(linha141.getByRole('button', { name: 'Pagar', exact: true })).toBeVisible();
  await expect(page.locator('tr[data-numero="142"]').getByRole('button', { name: 'Pagar', exact: true })).toHaveCount(0);

  // Pagar a 141 PELA TABELA com amortização extra de R$ 500 pelo campo próprio
  // do modal; a ação move para a próxima pendente.
  const paga = await pagarProximaNaTabela(page, 500);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await expect(linha141).toContainText('Paga');
  // A composição exibida é a do encadeamento do model (sem extras) do valor real.
  const pg = projecao(PARAMS_E2E, baselineDeHoje(), [
    { parcelaNumero: 141, valor: paga, dataPagamento: todayISO() },
  ], []).pagas[0];
  await expect(linha141).toContainText(formatBRL(pg.juros));
  await expect(linha141).toContainText(formatBRL(pg.correcao));
  await expect(linha141).toContainText(formatBRL(pg.seguro));
  await expect(linha141).toContainText(formatBRL(pg.amortizacao));
  // Com amortização extra do estado vigente até a data da paga, o Saldo do
  // encadeamento sem extras deixa de representar o saldo real: vira "—".
  await expect(linha141.locator('[data-cell="saldo"]')).toHaveText('—');
  // O aporte fica na linha da última paga anterior à data (a 141, paga hoje) e
  // o Total soma Parcela + Aporte.
  const valorExtra = 500;
  await expect(linha141.locator('[data-cell="aporte"]')).toHaveText(formatBRL(valorExtra));
  const parcelaAporte = parseBRL(await linha141.locator('[data-cell="parcela"]').innerText());
  const totalAporte = parseBRL(await linha141.locator('[data-cell="total"]').innerText());
  expect(totalAporte).toBeCloseTo(parcelaAporte + valorExtra, 2);

  // A parcela com amortização vinculada (groupId) é editável junto do aporte:
  // o Editar existe e o Apagar (última paga) remove o grupo inteiro.
  await expect(linha141.getByRole('button', { name: 'Editar parcela 141', exact: true })).toBeVisible();
  await expect(linha141.getByRole('button', { name: 'Apagar parcela 141', exact: true })).toBeVisible();

  // A 141 paga não tem mais "Pagar"; a ação passou para a 142.
  await expect(linha141.getByRole('button', { name: 'Pagar', exact: true })).toHaveCount(0);
  await expect(page.locator('tr[data-numero="142"]').getByRole('button', { name: 'Pagar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pagar', exact: true })).toHaveCount(1);
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

  // O pagamento move a linha 141 para "Paga" e o aporte REGISTRADO é exatamente
  // o exibido no card (aporte explícito no servidor), não alguns reais a menos.
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Paga', { timeout: 20_000 });

  // Tabela de parcelas: o aporte fica na linha da última paga anterior à data
  // (a 141, paga com o aporte), com o valor exato registrado e Total = Parcela +
  // Aporte.
  const numeroAporte = 141;
  const linhaAporte = page.locator(`tr[data-numero="${numeroAporte}"]`);
  await expect(linhaAporte.locator('[data-cell="aporte"]')).toHaveText(formatBRL(ideal), { timeout: 20_000 });
  const parcelaAporte = parseBRL(await linhaAporte.locator('[data-cell="parcela"]').innerText());
  const totalAporte = parseBRL(await linhaAporte.locator('[data-cell="total"]').innerText());
  expect(totalAporte).toBeCloseTo(parcelaAporte + ideal, 2);

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
  // registrada é o valor exibido (busca na coluna Aporte das linhas, sem
  // depender de qual competência recebeu o aporte).
  await expect
    .poll(
      async () =>
        (await page.locator('tr[data-row="parcela"] [data-cell="aporte"]').allInnerTexts())
          .filter((texto) => texto.trim() !== '-')
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

  await expect(page.locator('tr[data-numero="141"]')).toContainText('Paga');
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText('-');
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

  // O Apagar existe só na última paga (142); a 141, mais antiga, segue editável
  // mas não removível (o servidor recusaria criar lacuna).
  await expect(page.getByRole('button', { name: 'Apagar parcela 141', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apagar parcela 142', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar parcela 141', exact: true })).toBeVisible();

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
  // Os lançamentos do baseline superado continuam visíveis na tabela, agora com
  // o selo "Histórico" e sem ações (o servidor recusa editar estado superado).
  await expect(page.locator('tr[data-numero="142"]')).toContainText('Histórico', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Editar parcela 142', exact: true })).toHaveCount(0);
});

test('excedente do pagamento vira amortização extra vinculada e desfazer apaga o grupo', async ({ page }) => {
  const conta = await criarConta(page, 'Excedente do Pagamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  await box.getByLabel('Amortização extra (R$)').fill(centsOf(500));

  // Split em tempo real: parcela + amortização extra, modo default e nota.
  await expect(box.getByText(/Parcela .* \+ amortização extra/)).toBeVisible();
  await expect(box.getByText('Reduziu o prazo (parcela igual)', { exact: true })).toBeVisible();
  await expect(box.getByText(/O excedente será registrado como amortização extra/)).toBeVisible();

  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });

  // Excedente vira amortização: sem banner de divergência e com o aporte na
  // coluna Aporte da linha da paga (141).
  await expect(page.getByText(/Parcela 141 paga em/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);

  const linha141Excedente = page.locator('tr[data-numero="141"]');
  await expect(linha141Excedente).toContainText('Paga', { timeout: 20_000 });
  await expect(linha141Excedente.locator('[data-cell="aporte"]')).toHaveText(/R\$\s*500,00/);

  // Desfazer a parcela apaga o grupo inteiro (parcela + amortização extra).
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  const desfazerDialog = page.getByRole('dialog');
  await expect(desfazerDialog).toBeVisible();
  await expect(desfazerDialog.getByText(`Parcela 141 ·`)).toBeVisible();
  await desfazerDialog.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(desfazerDialog).toHaveCount(0, { timeout: 20_000 });

  await expect(page.getByText(/Parcela 141 paga em/)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: TITULO_CARD_MES, exact: true })).toBeVisible();
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Em aberto');
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText('-');
});

test('amortização extra pelo modal de pagamento encurta a quitação e aparece na tabela', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const box = page.locator('[data-pay-installment]');
  await expect(box).toBeVisible();
  await box.getByRole('button', { name: 'Definir hoje', exact: true }).click();
  const campoAporte = box.getByLabel('Amortização extra (R$)');
  await campoAporte.fill(centsOf(valorPequeno));
  await expect(box.locator('[data-efeito-aporte]')).toContainText('não reduz o prazo');
  await campoAporte.fill(centsOf(valorGrande));
  await expect(box.locator('[data-efeito-aporte]')).toContainText(/elimina \d+ parcela/);
  // Modo payment: o prazo não muda e o preview estima a parcela seguinte (mês 2
  // da engine); voltar ao term restaura o efeito no prazo.
  await box.getByRole('radio', { name: 'Reduziu a parcela (prazo igual)' }).click();
  await expect(box.locator('[data-efeito-aporte]')).toContainText('não reduz o prazo');
  await expect(box.locator('[data-efeito-aporte]')).toContainText('Parcela estimada:');
  await box.getByRole('radio', { name: 'Reduziu o prazo (parcela igual)' }).click();
  await expect(box.locator('[data-efeito-aporte]')).toContainText(/elimina \d+ parcela/);
  await box.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(box).toHaveCount(0, { timeout: 20_000 });

  // Sem pagas antes, o aporte cai na linha da paga (141) com o valor exato.
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText(
    formatBRL(valorGrande),
    { timeout: 20_000 },
  );

  // Hero: a amortização liga a micro-métrica de economia (antes mostrava "—").
  await expect(economiaCard(page)).toContainText(/R\$\s*[\d.,]+/);
  expect(parseBRL(await economiaCard(page).innerText())).toBeGreaterThan(0);

  // Seção Contratado vs real: com a amortização, as DUAS séries aparecem com a
  // legenda que distingue o cenário sem amortizações do real.
  await expect(page.getByRole('heading', { name: 'Contratado vs real', exact: true })).toBeVisible();
  await expect(page.getByText('Contratado (sem amortizações)', { exact: true })).toBeVisible();
  await expect(page.getByText('Real (com suas amortizações)', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Estimativa do modelo a partir do saldo atual: quanto você pagaria sem amortizações e o que está acontecendo com elas.',
      { exact: true },
    ),
  ).toBeVisible();

  const quitacaoDepois = parcelaNumeroDaQuitacao(await quitacaoCard(page).innerText());
  // Oráculo do modelo: a parcela paga (valor projetado) + a mesma amortização
  // no modelo puro derivam a parcela de quitação.
  const parcelaPaga = projecao(PARAMS_E2E, baselineDeHoje(), [], []).parcelas[0].parcela;
  const oracle = projecao(PARAMS_E2E, baselineDeHoje(), [
    { parcelaNumero: 141, valor: parcelaPaga, dataPagamento: todayISO() },
  ], [
    { dataPagamento: todayISO(), valor: valorGrande, origem: 'proprio', modo: 'term' },
  ]);
  expect(quitacaoDepois).toBe(oracle.quitaEm);
});

test('Levar ao Simulador transfere o cenário vigente para /simulacao', async ({ page }) => {
  const conta = await criarConta(page, 'Levar ao Simulador');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // O simulador (SimulationSandbox) consome a chave `sim-input` ao montar, então
  // o payload é capturado no momento do setItem e guardado no localStorage
  // (persiste na navegação client-side). /simulacao não expõe inputs de TR/seguro
  // (esses ficam em /nova-simulacao); o payload prova que a transferência carrega
  // todos os campos do contrato, sem ruído de float.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key === 'sim-input') window.localStorage.setItem('__mfLevarSimInput', value);
      return original.call(this, key, value);
    };
  });

  const botao = page.getByRole('button', { name: /Levar ao Simulador/i });
  await expect(botao).toBeVisible();
  await Promise.all([page.waitForURL(/\/simulacao$/), botao.click()]);

  const stored = JSON.parse(
    (await page.evaluate(() => window.localStorage.getItem('__mfLevarSimInput'))) ?? '{}',
  ) as Record<string, string>;
  expect(stored.principal).toBe('1000000');
  expect(stored.annualRate).toBe('10.5');
  expect(stored.trMonthly).toBe('0.17');
  expect(stored.insuranceMonthly).toBe('100,00');
  expect(stored.bank).toBe('Caixa');
  expect(stored.months).toBe('220');

  // Cabeçalho do simulador com o cenário do contrato: valor financiado (saldo
  // efetivo), taxa efetiva a.a., prazo restante (360 − 141 + 1 = 220) e banco.
  await expect(
    page.getByText(/Sistema PRICE · R\$\s*1\.000\.000,00 · 10\.50% a\.a\. · 220 meses · Caixa/),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Total pago', { exact: true }).first()).toBeVisible();
});

test('editar o pagamento com aporte atualiza parcela e amortização juntas', async ({ page }) => {
  const conta = await criarConta(page, 'Editar Pagamento com Aporte');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Paga a 141 com amortização extra de R$ 500 pela tabela.
  await pagarProximaNaTabela(page, 500);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  const linha = page.locator('tr[data-numero="141"]');
  await expect(linha.locator('[data-cell="aporte"]')).toHaveText(formatBRL(500), { timeout: 20_000 });

  // Editar o pagamento: valor/data + aporte vinculado saem no mesmo modal.
  await linha.getByRole('button', { name: 'Editar parcela 141', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByLabel('Amortização extra (R$)')).toHaveValue(/500,00/);
  await editor.getByLabel('Amortização extra (R$)').fill(centsOf(800));
  await editor.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(editor).toHaveCount(0, { timeout: 20_000 });
  await expect(linha.locator('[data-cell="aporte"]')).toHaveText(formatBRL(800), { timeout: 20_000 });
  const parcela = parseBRL(await linha.locator('[data-cell="parcela"]').innerText());
  const total = parseBRL(await linha.locator('[data-cell="total"]').innerText());
  expect(total).toBeCloseTo(parcela + 800, 2);

  // Zerar o aporte remove a amortização vinculada e mantém a parcela paga.
  await linha.getByRole('button', { name: 'Editar parcela 141', exact: true }).click();
  const editor2 = page.getByRole('dialog');
  await editor2.getByLabel('Amortização extra (R$)').fill('0');
  await editor2.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(editor2).toHaveCount(0, { timeout: 20_000 });
  await expect(linha.locator('[data-cell="aporte"]')).toHaveText('-', { timeout: 20_000 });
  await expect(linha).toContainText('Paga');

  // Apagar o pagamento volta a parcela para 141 e zera a coluna Aporte.
  await linha.getByRole('button', { name: 'Apagar parcela 141', exact: true }).click();
  const apagarDialog = page.getByRole('dialog');
  await expect(apagarDialog).toBeVisible();
  await apagarDialog.getByRole('button', { name: 'Apagar', exact: true }).click();
  await expect(apagarDialog).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Em aberto');
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText('-');
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
  await expect(page.getByRole('heading', { name: 'Parcelas do Financiamento', exact: true })).toBeVisible();
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
  // A tabela de parcelas segue como leitura, sem ação de pagar/editar/apagar.
  await expect(page.getByRole('button', { name: 'Pagar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Editar parcela \d+/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Apagar parcela \d+/ })).toHaveCount(0);
});

test('correção: apagar o pagamento da parcela 141 devolve a próxima parcela para 141', async ({ page }) => {
  const conta = await criarConta(page, 'Correção');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  const saldoOriginal = parseBRL(await saldoCard(page).innerText());
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });

  // Corrige o valor da parcela registrada pelo dialog de edição e depois apaga.
  await page.getByRole('button', { name: 'Editar parcela 141', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor).toBeVisible();
  const valorEditado = editor.getByLabel('Valor pago (R$)');
  const atual = parseBRL(await valorEditado.inputValue());
  await valorEditado.fill(centsOf(atual + 100));
  await editor.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(editor).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"] [data-cell="parcela"]')).toHaveText(
    formatBRL(atual + 100),
    { timeout: 20_000 },
  );

  await page.getByRole('button', { name: 'Apagar parcela 141', exact: true }).click();
  const apagarDialog = page.getByRole('dialog');
  await expect(apagarDialog).toBeVisible();
  await expect(apagarDialog.getByText('Apagar lançamento?')).toBeVisible();
  await expect(apagarDialog.getByText('Parcela 141 ·')).toBeVisible();
  await apagarDialog.getByRole('button', { name: 'Apagar', exact: true }).click();
  await expect(apagarDialog).toHaveCount(0, { timeout: 20_000 });

  await expect(proximaCard(page)).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  expect(parseBRL(await saldoCard(page).innerText())).toBeCloseTo(saldoOriginal, 2);
  await expect(page.getByText(/divergem do modelo/)).toHaveCount(0);
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Em aberto');
});

test('desfazer o pagamento pelo card volta a parcela 141 e limpa a tabela', async ({ page }) => {
  const conta = await criarConta(page, 'Desfazer Pagamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  await pagarProxima(page);
  await expect(page.getByText(/Parcela 141 paga em/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Paga');

  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  const desfazerDialog = page.getByRole('dialog');
  await expect(desfazerDialog).toBeVisible();
  await desfazerDialog.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(desfazerDialog).toHaveCount(0, { timeout: 20_000 });

  // O refresh apaga a confirmação, devolve a parcela 141 para o card e zera a
  // tabela (a linha volta a "Em aberto").
  await expect(page.getByText(/Parcela 141 paga em/)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: TITULO_CARD_MES, exact: true })).toBeVisible();
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Em aberto');
});

test('amortização do saldo inteiro zera o modelo, mostra o aviso âmbar e recalibrar restaura', async ({ page }) => {
  const conta = await criarConta(page, 'Zero por Lançamento');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());
  await expect(page.getByText('Financiamento quitado', { exact: true })).toHaveCount(0);

  // Lançamento equivocado: paga a parcela com amortização extra pelo saldo
  // devedor inteiro. O contrato segue ativo no banco (baseline R$ 1.000.000),
  // só o MODELO zera.
  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const dialog = page.locator('[data-pay-installment]');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Amortização extra (R$)').fill('200000000');
  await dialog.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });

  await expect(page.getByText(/zeraram o saldo no modelo/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Financiamento quitado', { exact: true })).toHaveCount(0);
  await expect(recalibrarNoBanner(page)).toBeVisible();

  // Extrato do banco mostra R$ 990.000: recalibra e o modelo volta a projetar.
  // A parcela 141 já foi paga, então a recalibração retoma da 142.
  await recalibrarNoBanner(page).click();
  const rec = page.getByRole('dialog');
  await expect(rec).toBeVisible();
  await expect(rec.locator('#recParcela')).toHaveValue('142');
  await rec.locator('#recSaldo').fill('99000000');
  await rec.getByRole('button', { name: 'Confirmar recalibração', exact: true }).click();

  await expect(page.getByText(/zeraram o saldo no modelo/)).toHaveCount(0, { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
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

  // O banner some e a página volta a projetar normalmente; os lançamentos do
  // período quitado seguem visíveis na tabela como histórico.
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
  // O passado congelado continua visível na tabela: a parcela 141 (paga antes
  // da edição) vira selo "Histórico" sem ações, e o Total pago é preservado.
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Histórico', { timeout: 20_000 });
  await expect
    .poll(async () => parseBRL(await totalCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(totalAntes, 2);
  // Lançamento de estado superado não é editável nem apagável.
  await expect(page.getByRole('button', { name: 'Editar parcela 141', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apagar parcela 141', exact: true })).toHaveCount(0);
});

test('Visão global preserva total pago, amortizado e economia após editar o contrato', async ({ page }) => {
  const conta = await criarConta(page, 'Visão Global Após Edição');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // A faixa global fica no topo, com a legenda de acumulado entre períodos.
  await expect(page.getByRole('heading', { name: 'Visão global', exact: true })).toBeVisible();
  await expect(
    page.getByText('desde o início do contrato, somando atualizações e portabilidades', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Situação atual', exact: true })).toBeVisible();
  await expect(
    page.getByText('situação vigente a partir da última atualização', { exact: true }),
  ).toBeVisible();

  // Destaque principal (falta pagar e economia), resumo, barra de capital e
  // secundários (total pago, amortizado e contagem).
  await expect(page.getByText('Falta pagar', { exact: true })).toBeVisible();
  await expect(page.getByText('Já economizado', { exact: true })).toBeVisible();
  await expect(page.getByText(/Você financiou R\$\s*1\.000\.000,00/)).toBeVisible();
  const barraGlobal = page.getByRole('progressbar', { name: 'Capital pago em relação ao valor original' });
  await expect(barraGlobal).toBeVisible();
  await expect(barraGlobal).toHaveAttribute('aria-valuenow', /^\d+$/);
  await expect(page.getByText(/pago · R\$\s*[\d.,]+ restante/)).toBeVisible();
  await expect(page.getByText('Total pago', { exact: true })).toBeVisible();
  await expect(page.getByText('Amortizado', { exact: true })).toBeVisible();
  await expect(page.getByText('Pagamentos registrados', { exact: true })).toBeVisible();

  // Sem amortizações no período vigente, as estatísticas da situação atual
  // aparecem como "—" com a legenda discreta.
  await expect(amortizadoSituacaoCard(page)).toContainText('—');
  await expect(economiaSituacaoCard(page)).toContainText('—');
  await expect(page.getByText('sem amortizações nesta situação', { exact: true })).toBeVisible();

  // Paga a parcela com amortização extra para haver economia antes da edição.
  await page.getByRole('button', { name: 'Paguei esta parcela', exact: true }).click();
  const amort = page.locator('[data-pay-installment]');
  await expect(amort).toBeVisible();
  await amort.getByRole('button', { name: 'Definir hoje', exact: true }).click();
  await amort.getByLabel('Amortização extra (R$)').fill('10000000');
  await amort.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(amort).toHaveCount(0, { timeout: 20_000 });

  // A paga 141 recebe o aporte de R$ 100.000 (última paga até a data).
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText(
    formatBRL(100000),
    { timeout: 20_000 },
  );

  // Faixa global: acumulado do contrato inteiro (um pagamento com amortização).
  // "Pagamentos registrados" conta lançamentos de pagamento, sem competir com a
  // "Parcela N de M" da situação atual: só a contagem, sem "de 360".
  await expect(pagamentosCard(page)).toContainText('1');
  await expect(pagamentosCard(page)).not.toContainText('de 360');
  // O valor original aparece no resumo (o card dedicado foi removido).
  await expect(page.getByText(/Você financiou R\$\s*1\.000\.000,00/)).toBeVisible();
  await expect(faltaPagarCard(page)).toContainText(/R\$\s*[\d.,]+/);
  const totalAntes = parseBRL(await totalCard(page).innerText());
  const amortizadoAntes = parseBRL(await amortizadoCard(page).innerText());
  const economiaAntes = parseBRL(await economiaCard(page).innerText());
  expect(totalAntes).toBeGreaterThan(0);
  expect(amortizadoAntes).toBeGreaterThan(0);
  expect(economiaAntes).toBeGreaterThan(0);

  // Situação atual: as estatísticas do período vigente refletem a amortização
  // recém-registrada (ambas acima de zero).
  await expect(amortizadoSituacaoCard(page)).toContainText(/R\$\s*[\d.,]+/);
  expect(parseBRL(await amortizadoSituacaoCard(page).innerText())).toBeGreaterThan(0);
  await expect(economiaSituacaoCard(page)).toContainText(/R\$\s*[\d.,]+/);
  expect(parseBRL(await economiaSituacaoCard(page).innerText())).toBeGreaterThan(0);

  // Edita o contrato: as amortizações viram passado congelado no período anterior.
  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#editAnnualRate').fill('9,8');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  // A amortização virou passado congelado: o aporte some da linha (o novo estado
  // não tem extras) e a situação atual volta a "—".
  await expect(page.locator('tr[data-numero="141"] [data-cell="aporte"]')).toHaveText('-', { timeout: 20_000 });

  // A faixa global mantém o total pago, o amortizado e a economia (não zera).
  await expect
    .poll(async () => parseBRL(await totalCard(page).innerText()), { timeout: 20_000 })
    .toBeCloseTo(totalAntes, 2);
  expect(parseBRL(await amortizadoCard(page).innerText())).toBeCloseTo(amortizadoAntes, 2);
  await expect
    .poll(async () => parseBRL(await economiaCard(page).innerText()), { timeout: 20_000 })
    .toBeGreaterThan(0);
  // Já a situação atual usa só os extras do período vigente: a amortização
  // virou passado congelado, então as estatísticas voltam a "—".
  await expect(amortizadoSituacaoCard(page)).toContainText('—');
  await expect(economiaSituacaoCard(page)).toContainText('—');
  await expect(page.getByText('sem amortizações nesta situação', { exact: true })).toBeVisible();
});

test('editar contrato aceita parcela anterior à pendente e remove os lançamentos futuros', async ({ page }) => {
  const conta = await criarConta(page, 'Editar Retroativo');
  await assinar(page, conta.id);
  await criarContrato(page, todayISO());

  // Paga a 141: o lançamento entra no estado vigente.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Paga');
  await expect(pagamentosCard(page)).toContainText('1');
  const saldoAntes = parseBRL(await saldoCard(page).innerText());

  // Edição NÃO retroativa (só troca o banco) cria um baseline novo: a paga 141
  // passa a viver num estado SUPERADO. É o cenário em que o unique global
  // (contractId, parcelaNumero) travava a competência reaberta.
  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#editBank').fill('Itaú');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText(/Itaú · PRICE/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Histórico');
  await expect(pagamentosCard(page)).toContainText('1');

  // Reabre a edição: a pendente vigente é a 142 e voltar para 141 é retroativo.
  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#editParcela')).toHaveValue('142');
  await expect(dialog.locator('#editDia')).toHaveValue('10');
  await expect(parseBRL(await dialog.locator('#editSaldo').inputValue())).toBeCloseTo(saldoAntes, 2);

  await dialog.locator('#editParcela').fill('141');
  await expect(
    dialog.getByText(
      'Editar para uma parcela anterior remove os pagamentos e amortizações posteriores do cálculo e do histórico. Esta ação não pode ser desfeita.',
    ),
  ).toBeVisible();
  const salvar = dialog.getByRole('button', { name: 'Salvar alterações', exact: true });
  await expect(salvar).toBeDisabled();
  await dialog.getByLabel('Entendi que os lançamentos posteriores serão removidos').check();
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(dialog).toHaveCount(0, { timeout: 20_000 });

  // A página volta a mostrar a parcela 141; o lançamento do estado superado foi
  // removido do cálculo E do histórico (a competência reaberta fica desocupada).
  await expect(page.locator('[data-month-action]')).toContainText('Parcela 141 de 360', { timeout: 20_000 });
  await expect(proximaCard(page)).toContainText('Parcela 141 de 360');
  const linha141 = page.locator('tr[data-numero="141"]');
  await expect(linha141).toContainText('Em aberto');
  await expect(linha141).not.toContainText('Histórico');
  await expect(pagamentosCard(page)).toContainText('0');
  await expect(page.getByRole('button', { name: 'Editar parcela 141', exact: true })).toHaveCount(0);

  // A parcela reaberta pode ser paga de novo, sem colisão no unique.
  await pagarProxima(page);
  await expect(proximaCard(page)).toContainText('Parcela 142 de 360', { timeout: 20_000 });
  await expect(page.locator('tr[data-numero="141"]')).toContainText('Paga');
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
  await expect(page.locator('tr[data-numero="142"]')).toContainText('Paga');
});
