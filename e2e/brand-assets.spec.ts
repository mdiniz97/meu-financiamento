import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectLoadedLogo(image: Locator, variant: 'logo' | 'symbol') {
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', new RegExp(`(?:%2F|/)brand(?:%2F|/)${variant}\\.png`));
  await expect.poll(() => image.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true);
  const dimensions = await image.evaluate((node) => {
    const image = node as HTMLImageElement;
    const box = image.getBoundingClientRect();
    return { ratio: box.width / box.height, naturalRatio: image.naturalWidth / image.naturalHeight };
  });
  expect(dimensions.ratio).toBeCloseTo(dimensions.naturalRatio, 1);
  if (variant === 'logo') expect(dimensions.ratio).toBeGreaterThan(4);
  else expect(dimensions.ratio).toBeCloseTo(1, 1);
}

async function cadastrar(page: Page) {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste Logo');
  await page.getByLabel('Email').fill(`logo-${crypto.randomUUID()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

test('navegação e rodapé usam logo fornecida sem repetir nome em texto', async ({ page }) => {
  await page.goto('/');
  for (const container of [page.getByRole('banner'), page.getByRole('contentinfo')]) {
    const link = container.getByRole('link', { name: /amortiza\.me/i });
    await expectLoadedLogo(link.getByRole('img', { name: 'Logo amortiza.me' }), 'logo');
    await expect(link).toHaveText('');
  }
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  const wordmark = page.getByRole('banner').getByRole('img', { name: 'Logo amortiza.me' });
  await expect.poll(() => wordmark.evaluate((node) => getComputedStyle(node).filter)).toMatch(/brightness\(0\).*invert\(1\)/);
  await expectLoadedLogo(wordmark, 'logo');
});

test('landing mobile usa símbolo compacto e logo completa no rodapé', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expectLoadedLogo(page.getByRole('banner').getByRole('img', { name: 'Logo amortiza.me' }), 'symbol');
  await expectLoadedLogo(page.getByRole('contentinfo').getByRole('img', { name: 'Logo amortiza.me' }), 'logo');
  for (const container of [page.getByRole('banner'), page.getByRole('contentinfo')]) {
    const geometry = await container.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: node.scrollWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(390);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  }
});

test('sidebar, cabeçalho mobile e drawer usam a mesma logo completa', async ({ page }) => {
  await cadastrar(page);
  await expectLoadedLogo(page.locator('aside').getByRole('img', { name: 'Logo amortiza.me' }), 'logo');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLoadedLogo(page.getByRole('banner').getByRole('img', { name: 'Logo amortiza.me' }), 'logo');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expectLoadedLogo(page.getByRole('dialog').getByRole('img', { name: 'Logo amortiza.me' }), 'logo');
});

test('assets otimizados preservam formatos e transparência dos originais', async ({ request }) => {
  for (const name of ['logo', 'symbol']) {
    const response = await request.get(`/brand/${name}.png`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (name === 'logo') {
      expect(width / height).toBeGreaterThan(4);
      expect(width / height).toBeLessThan(6);
    } else {
      expect(width).toBe(height);
    }
    expect(png[25]).toBe(6);
    expect(png.byteLength).toBeLessThan(300000);
  }
});

test('favicon contém símbolo em tamanhos próprios e ícone Apple é carregável', async ({ page, request }) => {
  const response = await request.get('/favicon.ico');
  expect(response.status()).toBe(200);
  const ico = await response.body();
  expect(ico.readUInt16LE(2)).toBe(1);
  const widths = Array.from({ length: ico.readUInt16LE(4) }, (_, index) => ico[6 + index * 16] || 256);
  expect(widths).toEqual([16, 32, 48, 256]);
  await page.goto('/');
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute('sizes', '180x180');
  const appleResponse = await request.get((await apple.getAttribute('href'))!);
  expect(appleResponse.status()).toBe(200);
  const png = await appleResponse.body();
  expect(png.readUInt32BE(16)).toBe(180);
  expect(png.readUInt32BE(20)).toBe(180);
});
