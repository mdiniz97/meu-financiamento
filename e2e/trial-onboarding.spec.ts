import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(target?.hostname !== 'localhost' || target.pathname !== '/financiamento_trial_test',
  'requires isolated local PostgreSQL');

async function createAccount(page: Page, email: string) {
  await page.goto('/?signup=1');
  await page.getByRole('textbox', { name: 'Nome' }).fill('Pessoa Trial');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Senha').fill('senhaTeste123');
  await page.getByRole('button', { name: 'Criar conta e ganhar 10 créditos' }).click();
  await expect(page).toHaveURL(/nova-simulacao/);
}

async function cleanup(email: string) {
  const account = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (account) await db.delete(schema.users).where(eq(schema.users.id, account.id));
}

test('oferta após cadastro mostra vídeo em loop; recusa mantém ativação no perfil', async ({ page }) => {
  const email = `trial-e2e-${crypto.randomUUID()}@example.test`;
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Sem cartão. Sem cobrança automática.')).toBeVisible();
    await expect(modal.getByText(/48 horas a partir do cadastro ou da reabertura/)).toBeVisible();
    const video = modal.locator('video');
    await expect(video).toBeVisible();
    expect(await video.evaluate(element => {
      const media = element as HTMLVideoElement;
      return { muted: media.muted, loop: media.loop, inline: media.playsInline };
    })).toEqual({ muted: true, loop: true, inline: true });
    await modal.getByRole('button', { name: 'Ativar som' }).click();
    expect(await video.evaluate(element => (element as HTMLVideoElement).muted)).toBe(false);
    await modal.getByRole('button', { name: 'Agora não' }).click();
    await expect(modal).toHaveCount(0);
    await page.goto('/perfil');
    await expect(page.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeVisible();
    await page.getByRole('button', { name: 'Ativar 7 dias grátis' }).click();
    await expect(page.getByText(/Trial ativo até/)).toBeVisible();
    await expect(page.getByText(/Trial · 7 dias/).first()).toBeVisible();
    await expect(page.locator('del').filter({ hasText: '199,90' })).toBeVisible();
    await expect(page.getByText(/Economize R\$\s?80,00/)).toBeVisible();
    await expect(page.getByText(/Sem cartão e sem cobrança automática/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ativar 7 dias grátis' })).toHaveCount(0);
    await page.goto('/assinar');
    await expect(page).toHaveURL(/\/perfil$/);

    // Ilimitado no trial: a landing troca "Minhas simulações" por "Meu financiamento".
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Meu financiamento', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Simulações', exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Menu de navegação' })
        .getByRole('link', { name: 'Meu financiamento', exact: true })
    ).toBeVisible();
  } finally {
    await cleanup(email);
  }
});

test('perfil reabre o modal da oferta pelo card do trial', async ({ page }) => {
  const email = `trial-reopen-${crypto.randomUUID()}@example.test`;
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Agora não' }).click();
    await expect(modal).toHaveCount(0);
    // Navegação SUAVE pelo menu (sem reload): era exatamente aqui que reabrir falhava.
    await page.getByRole('link', { name: 'Planos e créditos' }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await page.getByRole('button', { name: 'Ver oferta do trial' }).click();
    await expect(page.getByRole('dialog', { name: /7 dias do Ilimitado/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: /7 dias do Ilimitado/ }).locator('video')).toBeVisible();
  } finally {
    await cleanup(email);
  }
});

test('landing mostra Simulações (sem Ilimitado) apontando para o simulador', async ({ page }) => {
  const email = `trial-nav-free-${crypto.randomUUID()}@example.test`;
  try {
    await createAccount(page, email);
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Simulações', exact: true }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/nova-simulacao');
    await expect(page.getByRole('link', { name: 'Meu financiamento', exact: true })).toHaveCount(0);
    await expect(page.locator('del').filter({ hasText: '199,90' })).toBeVisible();
    await expect(page.getByText('Economize R$ 80,00')).toBeVisible();
  } finally {
    await cleanup(email);
  }
});

test('falha do vídeo abre oferta textual; CTA acessível em tela pequena', async ({ page }) => {
  const email = `trial-fallback-${crypto.randomUUID()}@example.test`;
  await page.setViewportSize({ width: 375, height: 667 });
  await page.route('**/videos/trial-manifesto-v2.mp4', route => route.abort());
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toBeVisible({ timeout: 7000 });
    await expect(modal.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeInViewport();
    await expect(modal.getByText('Sem cartão. Sem cobrança automática.')).toBeVisible();
  } finally {
    await cleanup(email);
  }
});

test('vídeo e CTA permanecem visíveis em viewport mobile', async ({ page }) => {
  const email = `trial-mobile-${crypto.randomUUID()}@example.test`;
  await page.setViewportSize({ width: 390, height: 720 });
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toBeVisible();
    await expect(modal.locator('video')).toBeInViewport();
    await expect(modal.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeInViewport();
  } finally {
    await cleanup(email);
  }
});

test('não abre modal antes de vídeo ficar reproduzível', async ({ page }) => {
  const email = `trial-slow-video-${crypto.randomUUID()}@example.test`;
  let releaseVideo: (() => void) | undefined;
  const holdVideo = new Promise<void>(resolve => { releaseVideo = resolve; });
  await page.route('**/videos/trial-manifesto-v2.mp4', async route => {
    await holdVideo;
    await route.continue();
  });
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toHaveCount(0);
    releaseVideo?.();
    await expect(modal).toBeVisible();
  } finally {
    releaseVideo?.();
    await cleanup(email);
  }
});

test('vídeo sem resposta mostra oferta em texto sem bloquear ativação', async ({ page }) => {
  const email = `trial-timeout-${crypto.randomUUID()}@example.test`;
  let releaseVideo: (() => void) | undefined;
  const holdVideo = new Promise<void>(resolve => { releaseVideo = resolve; });
  await page.route('**/videos/trial-manifesto-v2.mp4', async route => {
    await holdVideo;
    await route.abort();
  });
  try {
    await createAccount(page, email);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toHaveCount(0);
    await expect(modal).toBeVisible({ timeout: 6500 });
    await expect(modal.locator('video')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Ativar 7 dias grátis' })).toBeVisible();
  } finally {
    releaseVideo?.();
    await cleanup(email);
  }
});

test('movimento reduzido pausa autoplay e permite reprodução manual em loop', async ({ page }) => {
  const email = `trial-reduced-motion-${crypto.randomUUID()}@example.test`;
  try {
    await page.goto('/?signup=1');
    await expect(page.getByRole('textbox', { name: 'Nome' })).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('textbox', { name: 'Nome' }).fill('Pessoa Trial');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Senha').fill('senhaTeste123');
    await page.getByRole('button', { name: 'Criar conta e ganhar 10 créditos' }).click();
    await expect(page).toHaveURL(/nova-simulacao/);
    const modal = page.getByRole('dialog', { name: /7 dias do Ilimitado/ });
    await expect(modal).toBeVisible();
    const video = modal.locator('video');
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
    await modal.getByRole('button', { name: 'Reproduzir vídeo' }).click();
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false);
    expect(await video.evaluate(element => (element as HTMLVideoElement).loop)).toBe(true);
  } finally {
    await cleanup(email);
  }
});

test('conta anterior não recebe modal nem baixa vídeo', async ({ page }) => {
  const email = `trial-old-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({
    name: 'Antigo', email, passwordHash: await bcrypt.hash('senhaTeste123', 10),
  }).returning();
  const videoRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/videos/trial-manifesto-v2.mp4')) videoRequests.push(request.url());
  });
  try {
    await page.goto('/?login=1');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByLabel('Senha').fill('senhaTeste123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/nova-simulacao/);
    await expect(page.getByRole('dialog', { name: /7 dias do Ilimitado/ })).toHaveCount(0);
    await page.goto('/perfil');
    await expect(page.getByRole('button', { name: 'Ativar 7 dias grátis' })).toHaveCount(0);
    expect(videoRequests).toEqual([]);
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});
