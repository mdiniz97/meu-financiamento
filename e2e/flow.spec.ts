import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const hasPsql = (() => {
  try {
    execSync('which psql', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

async function cadastrar(page: Page) {
  const email = `user${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  return email;
}

test('cadastro → simular (auto-save 1 crédito) → comprar créditos', async ({ page }) => {
  await cadastrar(page);
  await expect(page).toHaveURL(/nova-simulacao/);

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/total pago/i).first()).toBeVisible();
  await expect(page.getByText('Simulação salva automaticamente')).toBeVisible();

  await page.goto('/perfil');
  await page.getByRole('button', { name: /5 créditos/i }).click();
  await page.waitForURL(/\/perfil/);
  await expect(page.getByText('Saldo de créditos').locator('..').getByText('6', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /5 créditos/i }).click();
  await page.waitForURL(/\/perfil/);
  await expect(page.getByText('Saldo de créditos').locator('..').getByText('11', { exact: true })).toBeVisible();
});

test('gate ilimitado: PDF bloqueado sem assinatura', async ({ page }) => {
  await cadastrar(page);
  await page.waitForURL(/nova-simulacao/);
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/exclusivo/i).first()).toBeVisible();
});

test('botão Simular mostra consumo de 1 moeda para quem não é Ilimitado', async ({ page }) => {
  await cadastrar(page);
  await page.waitForURL(/nova-simulacao/);
  const simulate = page.getByRole('button', { name: /simular/i });
  await expect(simulate).toContainText('-1');
  await expect(simulate.locator('svg')).toHaveCount(1);
});

test('simulação de usuário free não é salva após a janela de 6 horas', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = `ttl-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);

  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -c "insert into simulations (id, user_id, name, payload, result, system, credits_spent, created_at) values (gen_random_uuid(), '${uid}', 'Simulação expirada', '{}', '{}', 'PRICE', 1, now() - interval '7 hours')"`
  );

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText('Nenhuma simulação salva ainda.')).toBeVisible();
});

test('simulação de assinante Ilimitado fica listada (sem janela de 6 horas)', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = `unl-ttl-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const res = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(res.ok()).toBeTruthy();
  execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -c "insert into simulations (id, user_id, name, payload, result, system, credits_spent, created_at) values (gen_random_uuid(), '${uid}', 'Simulação antiga', '{}', '{}', 'PRICE', 1, now() - interval '3 days')"`
  );

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText('Simulação antiga')).toBeVisible();
});

test('banners de upgrade aparecem para free (simulacao, juros, minhas-simulacoes) e somem para Ilimitado', async ({ page }) => {
  await cadastrar(page);
  await page.waitForURL(/nova-simulacao/);

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/simulacao/);
  await expect(page.getByRole('button', { name: /assinar ilimitado/i })).toBeVisible();

  await page.goto('/juros');
  await expect(page.getByRole('button', { name: /assinar ilimitado/i })).toBeVisible();

  await page.goto('/minhas-simulacoes');
  await expect(page.getByText(/suas simulações expiram em/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /assinar ilimitado/i })).toBeVisible();

  await page.getByRole('button', { name: /assinar ilimitado/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Recurso exclusivo do plano Ilimitado');
  await expect(page.getByRole('dialog')).toContainText('5 créditos');
});

test('assinante Ilimitado não vê banners de upgrade', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = `unl-banner-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const res = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(res.ok()).toBeTruthy();

  await page.goto('/juros');
  await expect(page.getByRole('button', { name: /assinar ilimitado/i })).toHaveCount(0);
  await page.goto('/minhas-simulacoes');
  await expect(page.getByRole('button', { name: /assinar ilimitado/i })).toHaveCount(0);
});

test('assinante Ilimitado não vê opções de compra no perfil', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = `unl-perfil-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(
    `psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`
  ).toString().trim();
  const res = await page.request.get(
    `/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`
  );
  expect(res.ok()).toBeTruthy();

  await page.goto('/perfil');
  await expect(page.getByText('Assinatura ilimitada ativa')).toBeVisible();
  await expect(page.getByRole('button', { name: /comprar|assinar/i })).toHaveCount(0);
});

test('assinar pela landing: não logado cai no login e depois no checkout do Ilimitado', async ({ page }) => {
  test.skip(!hasPsql, 'requer psql local');
  const email = `assinar-${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL(/login/);

  await page.goto('/assinar');
  await page.waitForURL(/\/login\?callbackUrl=\/assinar/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/\/perfil/);
  await expect(page.getByText('Assinatura ilimitada ativa')).toBeVisible();
});
