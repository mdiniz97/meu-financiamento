import { expect, test } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../src/db';
import { awardReferralForSavedSimulation } from '../src/lib/referrals/award';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = target?.hostname === 'localhost' && target.pathname === '/financiamento_referrals_test';

test('visitante sem sessão é redirecionado ao login para ver indicações', async ({ page }) => {
  await page.goto('/indique-amigos');
  await expect(page).toHaveURL(/login=1/);
});

test.skip(!isolated, 'requires isolated local PostgreSQL');

test('cadastro por convite reserva vaga e histórico mostra apenas email mascarado', async ({ browser }) => {
  const inviterEmail = `inviter-${crypto.randomUUID()}@example.test`;
  const inviteeEmail = `convidada-${crypto.randomUUID()}@example.test`;
  const inviter = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const invitee = await browser.newContext();
  try {
    const inviterPage = await inviter.newPage();
    await inviterPage.goto('/?signup=1');
    await inviterPage.getByRole('textbox', { name: 'Nome' }).fill('Convidante');
    await inviterPage.getByRole('textbox', { name: 'Email' }).fill(inviterEmail);
    await inviterPage.getByLabel('Senha').fill('senhaTeste123');
    await inviterPage.getByRole('button', { name: 'Criar conta e ganhar 10 créditos' }).click();
    await expect(inviterPage).toHaveURL(/nova-simulacao/);
    await inviterPage.getByRole('button', { name: 'Abrir menu' }).click();
    await inviterPage.getByRole('link', { name: 'Indique amigos' }).click();
    await expect(inviterPage.getByRole('heading', { name: 'Indique amigos' })).toBeVisible();
    const link = await inviterPage.getByRole('textbox', { name: 'Seu link' }).inputValue();
    expect(link).toMatch(/\/indicar\/c\/[A-Za-z0-9_-]{22}$/);
    await inviter.grantPermissions(['clipboard-read', 'clipboard-write']);
    await inviterPage.getByRole('button', { name: 'Copiar convite' }).click();
    expect(await inviterPage.evaluate(() => navigator.clipboard.readText())).toBe(
      `Olá! Cadastre-se no amortiza.me pelo meu link: ${link}\n\n` +
      'Você ganha 10 créditos ao criar sua conta. Depois da sua primeira simulação salva, nós dois ganhamos +5 créditos!'
    );

    const inviteePage = await invitee.newPage();
    await inviteePage.goto(link);
    await expect(inviteePage).toHaveURL(/signup=1/);
    await inviteePage.getByRole('textbox', { name: 'Nome' }).fill('Convidada');
    await inviteePage.getByRole('textbox', { name: 'Email' }).fill(inviteeEmail);
    await inviteePage.getByLabel('Senha').fill('senhaTeste123');
    await inviteePage.getByRole('button', { name: 'Criar conta e ganhar 10 créditos' }).click();
    await expect(inviteePage).toHaveURL(/nova-simulacao/);
    await inviterPage.reload();
    await expect(inviterPage.getByText('Aguardando primeira simulação')).toBeVisible();
    expect(await inviterPage.locator('body').innerHTML()).not.toContain(inviteeEmail);
    const [invited] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, inviteeEmail));
    await db.transaction(tx => awardReferralForSavedSimulation(tx, invited.id));
    await inviterPage.reload();
    await expect(inviterPage.getByText('+5 créditos recebidos')).toBeVisible();
    expect(await inviterPage.locator('body').innerHTML()).not.toContain(inviteeEmail);
  } finally {
    await inviter.close();
    await invitee.close();
    const accounts = await db.select({ id: schema.users.id }).from(schema.users)
      .where(inArray(schema.users.email, [inviterEmail, inviteeEmail]));
    if (accounts.length) await db.delete(schema.users).where(inArray(schema.users.id, accounts.map(account => account.id)));
  }
});
