import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const hasPsql = (() => {
  try { execSync('which psql', { stdio: 'ignore' }); return true; } catch { return false; }
})();

async function cadastrarEAssinar(page: Page) {
  const email = `port-rate${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(`psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`).toString().trim();
  const response = await page.request.get(`http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`);
  expect(response.ok()).toBeTruthy();
}

async function cadastrarSemPlano(page: Page) {
  const email = `port-gate${Date.now()}${Math.random().toString(36).slice(2, 8)}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('plano sem acesso vê gate premium e não vê formulário', async ({ page }) => {
  await cadastrarSemPlano(page);
  await page.goto('/portabilidade');
  await expect(page.getByText('Recurso exclusivo do plano Ilimitado')).toBeVisible();
  await expect(page.getByRole('button', { name: /comparar contrato atual e proposta/i })).toHaveCount(0);
});

test('taxas inválidas bloqueiam cálculo e busca inteligente sem pageerror', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await cadastrarEAssinar(page);
  await page.goto('/portabilidade');

  await page.getByRole('button', { name: /comparar contrato atual e proposta/i }).evaluate(
    (button: HTMLButtonElement) => button.click()
  );
  await expect(page.getByText(/vale a pena|não vale a pena/i).first()).toBeVisible();
  const currentRate = page.getByRole('textbox', { name: 'Taxa atual', exact: true });
  await currentRate.fill('-');
  await expect(currentRate).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: /comparar contrato atual e proposta/i }).evaluate(
    (button: HTMLButtonElement) => button.click()
  );
  await expect(page.getByText('Informe uma taxa atual válida.').last()).toBeVisible();

  await page.getByRole('switch').click();
  await currentRate.fill('-');
  await page.getByRole('button', { name: /buscar taxa ideal/i }).evaluate(
    (button: HTMLButtonElement) => button.click()
  );
  await expect(page.getByText('Informe uma taxa atual válida.').last()).toBeVisible();
  expect(errors).toEqual([]);
});

test('valores monetários com centavos persistem no cálculo sem multiplicar por 100', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  await cadastrarEAssinar(page);
  await page.goto('/portabilidade');

  const values = [
    ['Saldo devedor atual (R$)', '80000001', /^R\$\s800\.000,01$/],
    ['Seguro atual (R$/mês)', '10001', /^R\$\s100,01$/],
    ['Novo seguro (R$/mês)', '9002', /^R\$\s90,02$/],
    ['Custos da portabilidade (R$)', '123456', /^R\$\s1\.234,56$/],
  ] as const;
  for (const [label, digits, formatted] of values) {
    const field = page.getByRole('textbox', { name: label });
    await field.fill(digits);
    await field.blur();
    await expect(field).toHaveValue(formatted);
  }

  await page.getByRole('switch', { name: 'Busca inteligente' }).click();
  const target = page.getByRole('textbox', { name: 'Parcela desejada (R$, opcional)' });
  await target.fill('500001');
  await target.blur();
  await expect(target).toHaveValue(/^R\$\s5\.000,01$/);
  await page.getByRole('button', { name: /comparar contrato atual e proposta/i }).click();
  await expect(page.getByText(/vale a pena|não vale a pena/i).first()).toBeVisible();
});
