import { expect, test, type Page } from '@playwright/test';

async function cadastrar(page: Page) {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste SEO');
  await page.getByLabel('Email').fill(`seo-${crypto.randomUUID()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
}

for (const { path, subject } of [
  { path: '/', subject: /simulador de financiamento imobiliário/i },
  { path: '/juros', subject: /juros.*selic.*ipca.*tr/i },
  { path: '/custos-da-compra', subject: /custos.*imóvel.*entrada.*itbi/i },
  { path: '/blog', subject: /blog.*financiamento/i },
]) {
  test(`SEO público de ${path} identifica página sem canonical genérico ou parâmetros`, async ({ page }) => {
    await page.goto(`${path}?utm_source=teste`);
    await expect(page).toHaveTitle(subject);
    await expect(page).toHaveTitle(/amortiza\.me/);
    const canonical = `https://amortiza.me${path === '/' ? '' : path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{60,}/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'amortiza.me');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'pt_BR');
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https:\/\/amortiza\.me\/opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  });
}

test('marca pública e dados estruturados identificam amortiza.me sem mudar o Raio X', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner').getByRole('link', { name: /amortiza\.me/i })).toBeVisible();
  await expect(page.getByRole('contentinfo').getByRole('link', { name: /amortiza\.me/i })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('img', { name: 'Logo amortiza.me' })).toBeVisible();
  const graph = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? '{}'));
  expect(graph['@graph']).toEqual(expect.arrayContaining([
    expect.objectContaining({ '@type': 'WebSite', name: 'amortiza.me', url: 'https://amortiza.me' }),
    expect.objectContaining({ '@type': 'Organization', name: 'amortiza.me', url: 'https://amortiza.me' }),
  ]));
});

test('cada artigo tem canonical próprio e esquema coerente com o conteúdo visível', async ({ page }) => {
  const slugs = [
    'quanto-preciso-para-comprar', 'sac-ou-price', 'quitar-financiamento-antes',
    'qual-banco-financia-melhor', 'selic-alta-investir-ou-amortizar',
    'portabilidade-de-financiamento', 'juros-do-financiamento',
  ];
  for (const slug of slugs) {
    await page.goto(`/blog/${slug}?utm_source=teste`);
    const canonical = `https://amortiza.me/blog/${slug}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page).toHaveTitle(/\| amortiza\.me$/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https:\/\/amortiza\.me\//);
    const data = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? '{}'));
    const article = data['@graph'].find((item: { '@type': string }) => item['@type'] === 'BlogPosting');
    expect(article).toMatchObject({
      headline: (await page.getByRole('heading', { level: 1 }).innerText()).trim(),
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      dateModified: await page.locator('time').getAttribute('datetime'),
      inLanguage: 'pt-BR',
      publisher: { '@type': 'Organization', name: 'amortiza.me', url: 'https://amortiza.me' },
    });
    const breadcrumbs = data['@graph'].find((item: { '@type': string }) => item['@type'] === 'BreadcrumbList');
    expect(breadcrumbs.itemListElement.at(-1).item).toBe(canonical);
    expect(breadcrumbs.itemListElement[1].item).toBe('https://amortiza.me/blog');
  }
});

test('sitemap lista apenas páginas públicas canônicas com datas reais dos artigos', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(urls.sort()).toEqual([
    'https://amortiza.me',
    'https://amortiza.me/juros',
    'https://amortiza.me/custos-da-compra',
    'https://amortiza.me/blog',
    'https://amortiza.me/blog/quanto-preciso-para-comprar',
    'https://amortiza.me/blog/sac-ou-price',
    'https://amortiza.me/blog/quitar-financiamento-antes',
    'https://amortiza.me/blog/qual-banco-financia-melhor',
    'https://amortiza.me/blog/selic-alta-investir-ou-amortizar',
    'https://amortiza.me/blog/portabilidade-de-financiamento',
    'https://amortiza.me/blog/juros-do-financiamento',
  ].sort());
  expect(xml).toContain('<lastmod>2026-09-08');
});

test('robots anuncia sitemap definitivo sem bloquear acesso às páginas públicas', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const robots = await response.text();
  expect(robots).toContain('Sitemap: https://amortiza.me/sitemap.xml');
  expect(robots).toMatch(/^Allow: \/$/m);
  expect(robots).not.toMatch(/^Disallow: \/$/m);
  expect(robots).not.toMatch(/^Disallow: \/(blog|juros|custos-da-compra)/m);
  expect(robots).not.toMatch(/^Disallow: \/api(?:\/|$)/m);
});

test('imagem Open Graph é PNG público com dimensões de compartilhamento', async ({ request }) => {
  const response = await request.get('/opengraph-image');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');
  const png = await response.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('login e cadastro não são indexáveis nem herdam canonical da landing', async ({ page }) => {
  for (const path of ['/login', '/cadastro']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https:\/\/amortiza\.me\//);
  }
});

test('checkout e APIs recebem noindex também nas respostas sem HTML', async ({ request }) => {
  for (const path of ['/assinar', '/api/pdf', '/api/pdf/comparison']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  }
});

test('app privado usa marca nova e noindex; páginas públicas continuam indexáveis com sessão', async ({ page }) => {
  await cadastrar(page);
  await expect(page.locator('aside').getByRole('link', { name: /amortiza\.me/i })).toBeVisible();
  for (const path of ['/nova-simulacao', '/minhas-simulacoes', '/perfil', '/meta-de-quitacao']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
  for (const path of ['/juros', '/custos-da-compra']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://amortiza.me${path}`);
  }
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await page.waitForURL(/\/simulacao$/);
  await expect(page.getByText('Raio X da dívida', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('banner').getByRole('link', { name: /amortiza\.me/i })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img', { name: 'Logo amortiza.me' })).toBeVisible();
});
