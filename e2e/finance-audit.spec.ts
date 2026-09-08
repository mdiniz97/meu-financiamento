import { expect, test, type Page } from '@playwright/test';
import { recommendSmart } from '../src/lib/finance/smart';
import { simulate } from '../src/lib/finance/engine';
import { formToInput, formToStrategies, parseStoredForm } from '../src/lib/simulation-context';

async function assinar(page: Page) {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Auditoria');
  await page.getByLabel('Email').fill(`audit-${crypto.randomUUID()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  const signup = page.waitForResponse((response) => response.url().endsWith('/api/signup') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  const response = await signup;
  expect(response.ok()).toBe(true);
  const { id } = await response.json() as { id: string };
  await page.waitForURL(/nova-simulacao/);
  const upgrade = await page.request.get(`/api/webhooks/payments?fake=approve&userId=${id}&packId=unlimited`);
  expect(upgrade.ok()).toBe(true);
}

test('abrir recomendação Smart mantém o modo e o custo do cenário mostrado', async ({ page }) => {
  await assinar(page);
  await page.goto('/amortizador-inteligente');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  const best = page.getByText('Melhor prazo para o seu orçamento', { exact: true }).locator('..');
  await expect(best).toBeVisible();
  const summary = await best.innerText();
  const total = summary.match(/Total\s+(R\$\s*[\d.,]+)/)?.[1];
  const months = summary.match(/Quita em (\d+) meses/)?.[1];
  expect(total).toBeTruthy();
  expect(months).toBeTruthy();
  await best.getByRole('button', { name: /abrir no simulador/i }).click();
  await page.waitForURL(/\/simulacao$/);
  await expect(page.getByText('Total pago', { exact: true }).first().locator('..')).toContainText(total!);
  await expect(page.getByText('Quita em', { exact: true }).locator('..')).toContainText(`${months} meses`);
});

test('meta SAC mostra aporte fixo adicional e primeira prestação acima do boleto atual', async ({ page }) => {
  await assinar(page);
  await page.goto('/meta-de-quitacao');
  await page.getByRole('textbox', { name: 'Saldo devedor (R$)' }).fill('40000000');
  await page.getByRole('textbox', { name: 'Prazo restante (meses)' }).fill('360');
  await page.getByRole('textbox', { name: 'Taxa do financiamento', exact: true }).fill('12');
  await page.getByRole('textbox', { name: 'Quero quitar em (anos)' }).fill('15');
  await page.getByRole('radio', { name: 'SAC', exact: true }).click();
  await page.getByRole('button', { name: 'Calcular aporte', exact: true }).click();
  await expect(page.getByText('Aporte mensal fixo', { exact: true }).locator('..')).toContainText(/R\$\s*1\.111,11/);
  await expect(page.getByText('Total no primeiro mês', { exact: true }).locator('..')).toContainText(/R\$\s*6\.017,74/);
});

test('alugar ou comprar rejeita horizonte e aluguel fora das premissas cobertas', async ({ page }) => {
  await assinar(page);
  await page.goto('/alugar-ou-comprar');
  await page.getByRole('textbox', { name: 'Horizonte (anos)' }).fill('40');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  const alertaHorizonte = page.getByRole('alert').filter({ hasText: /prazo do financiamento/i });
  await expect(alertaHorizonte).toContainText(/horizonte.*prazo do financiamento/i);
  await page.getByRole('textbox', { name: 'Horizonte (anos)' }).fill('10');
  await page.getByRole('textbox', { name: 'Aluguel mensal (R$)' }).fill('9900000');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  const alertaAluguel = page.getByRole('alert').filter({ hasText: /aluguel/i });
  await expect(alertaAluguel).toContainText(/aluguel.*parcela/i);
  await expect(page.getByRole('heading', { name: 'Resultado', exact: true })).toHaveCount(0);
});

test('Smart transfere PRICE payment com custo distinto de term no mesmo prazo', async ({ page }) => {
  const rec = recommendSmart({
    principal: 1000000, annualRate: 0.105, trMonthly: 0.17 / 100, insuranceMonthly: 100,
    bank: 'Caixa', maxPayment: 11000, maxMonths: 360,
  });
  const best = rec.best!;
  expect(best.result.strategies.reduceMode).toBe('payment');
  const term = simulate(best.result.input, { ...best.result.strategies, reduceMode: 'term' });
  expect(Math.abs(term.metrics.totalPago - best.result.metrics.totalPago)).toBeGreaterThan(0.01);
  await assinar(page);
  await page.goto('/amortizador-inteligente');
  await page.locator('#smartMaxPayment2').fill('1100000');
  await page.getByRole('button', { name: /calcular melhor modelo/i }).click();
  const shown = page.getByText('Melhor prazo para o seu orçamento', { exact: true }).locator('..');
  await expect(shown).toBeVisible();
  const summary = await shown.innerText();
  const total = summary.match(/Total\s+(R\$\s*[\d.,]+)/)?.[1];
  expect(total).toBeTruthy();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'sim-input') original.call(this, 'audit-smart-candidate', value);
      original.call(this, key, value);
    };
  });
  await shown.getByRole('button', { name: /abrir no simulador/i }).click();
  await page.waitForURL(/\/simulacao$/);
  const raw = await page.evaluate(() => sessionStorage.getItem('audit-smart-candidate'));
  expect(raw).not.toBeNull();
  const form = parseStoredForm(raw);
  expect(formToInput(form)).toEqual(best.result.input);
  expect(formToStrategies(form)).toEqual(best.result.strategies);
  await expect(page.getByText('Total pago', { exact: true }).last().locator('..')).toContainText(total!);
  await expect(page.getByText('Quita em', { exact: true }).locator('..')).toContainText(`${best.result.metrics.saldoZeroAt} meses`);
});
