import { expect, test } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

const PAGES: Array<{ path: string; canonical: string }> = [
  { path: '/', canonical: 'https://amortiza.me' },
  { path: '/juros', canonical: 'https://amortiza.me/juros' },
  { path: '/custos-da-compra', canonical: 'https://amortiza.me/custos-da-compra' },
  { path: '/negociacao', canonical: 'https://amortiza.me/negociacao' },
  { path: '/blog', canonical: 'https://amortiza.me/blog' },
];

for (const { path, canonical } of PAGES) {
  test(`SEO básico em ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(/amortiza\.me/);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect((description ?? '').length).toBeGreaterThan(20);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  });
}

test('sitemap.xml expõe as páginas públicas', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  for (const url of ['/juros', '/custos-da-compra', '/negociacao', '/blog']) {
    expect(body).toContain(url);
  }
});
