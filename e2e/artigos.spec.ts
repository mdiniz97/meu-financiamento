import { expect, test } from '@playwright/test';

test('lista do blog mostra os 7 artigos e navega ao artigo', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
  await expect(page.getByText(/Entrada e custos da compra/i)).toBeVisible();
  await expect(page.getByText(/SAC vs PRICE/i)).toBeVisible();
  await expect(page.getByText(/Quitar o financiamento antes/i)).toBeVisible();
  await expect(page.getByText(/Qual banco financia melhor/i)).toBeVisible();
  await expect(page.getByText(/Selic alta/i)).toBeVisible();
  await expect(page.getByText(/Portabilidade de financiamento/i)).toBeVisible();
  await expect(page.getByText(/Juros do financiamento: nominal, efetiva e CET/i)).toBeVisible();

  await page.getByRole('link', { name: /SAC vs PRICE/i }).click();
  await page.waitForURL(/\/blog\/sac-ou-price$/);
  await expect(page.getByRole('heading', { name: /SAC vs PRICE/i })).toBeVisible();
});

test('artigo renderiza seções, nota e CTA', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  await expect(page.getByRole('heading', { name: /PRICE: parcela constante/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /SAC: parcela que começa alta/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /comparar sac e price no simulador/i })).toBeVisible();
});

test('fim do artigo sugere outros artigos', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  await expect(page.getByRole('heading', { name: 'Continue aprendendo' })).toBeVisible();
  const cards = page.getByRole('link', { name: /Ler$/ });
  await expect(cards.first()).toBeVisible();
  await cards.first().click();
  await page.waitForURL(/\/blog\/(?!sac-ou-price$).*/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continue aprendendo' })).toBeVisible();
});

test('CTA do artigo de custos leva à calculadora pública', async ({ page }) => {
  await page.goto('/blog/quanto-preciso-para-comprar');
  await page.getByRole('link', { name: /calcular meus custos de compra/i }).click();
  await page.waitForURL(/\/custos-da-compra$/);
  await expect(page.getByRole('heading', { name: 'Quanto preciso para comprar?' })).toBeVisible();
});

test('rota antiga /artigos redireciona para o blog', async ({ page }) => {
  await page.goto('/artigos');
  await page.waitForURL(/\/blog$/);
  await page.goto('/artigos/sac-ou-price');
  await page.waitForURL(/\/blog\/sac-ou-price$/);
});

test('home tem seção do blog com artigos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /aprenda antes de assinar o contrato/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /ver todos os artigos/i })).toBeVisible();
  await page.getByRole('link', { name: /SAC vs PRICE/i }).first().click();
  await page.waitForURL(/\/blog\/sac-ou-price$/);
});

test('slug inexistente retorna 404', async ({ page }) => {
  const response = await page.goto('/blog/nao-existe');
  expect(response?.status()).toBe(404);
});

test('página de juros recomenda o artigo de juros', async ({ page }) => {
  await page.goto('/juros');
  await expect(page.getByRole('heading', { name: 'Aprenda mais sobre juros' })).toBeVisible();
  await page.getByRole('link', { name: /juros do financiamento: nominal, efetiva e cet/i }).click();
  await page.waitForURL(/\/blog\/juros-do-financiamento$/);
  await expect(page.getByRole('heading', { name: /Juros do financiamento/i })).toBeVisible();
});

test('página de custos recomenda o artigo da compra', async ({ page }) => {
  await page.goto('/custos-da-compra');
  await expect(page.getByRole('heading', { name: 'Leia sobre a compra do imóvel' })).toBeVisible();
  await page.getByRole('link', { name: /entrada e custos da compra/i }).first().click();
  await page.waitForURL(/\/blog\/quanto-preciso-para-comprar$/);
});

test('guias têm sumário navegável, perguntas frequentes e fontes consultáveis', async ({ page }) => {
  for (const slug of [
    'quanto-preciso-para-comprar', 'sac-ou-price', 'quitar-financiamento-antes',
    'qual-banco-financia-melhor', 'selic-alta-investir-ou-amortizar',
    'portabilidade-de-financiamento', 'juros-do-financiamento',
  ]) {
    await page.goto(`/blog/${slug}`);
    const toc = page.getByRole('navigation', { name: 'Neste artigo' });
    await expect(toc).toBeVisible();
    const links = await toc.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^#secao-/);
      const heading = page.locator(href!);
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText((await link.innerText()).trim());
    }
    const lastLink = links.at(-1)!;
    const target = await lastLink.getAttribute('href');
    await lastLink.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
    await expect(page.locator(target!)).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Perguntas frequentes', exact: true })).toBeVisible();
    const sources = page.getByRole('region', { name: 'Fontes e referências' });
    await expect(sources).toBeVisible();
    const sourceLinks = await sources.getByRole('link').all();
    expect(sourceLinks.length).toBeGreaterThan(0);
    for (const link of sourceLinks) {
      expect(await link.getAttribute('href')).toMatch(/^https:\/\//);
    }
    await expect(page.locator('time')).toHaveAttribute('datetime', '2026-09-08');
  }
});

test('exemplo SAC e PRICE usa tabela acessível e premissas explícitas', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  const table = page.getByRole('table', { name: /comparação.*400 mil/i });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'PRICE', exact: true })).toHaveAttribute('scope', 'col');
  await expect(table.getByRole('rowheader', { name: 'Primeira prestação' })).toHaveAttribute('scope', 'row');
  await expect(table.getByRole('row', { name: /Primeira prestação/ })).toContainText('R$ 3.518,03');
  await expect(table.getByRole('row', { name: /Primeira prestação/ })).toContainText('R$ 4.453,17');
  await expect(page.getByText(/sem TR, IPCA, seguros ou tarifas/i).first()).toBeVisible();
});

test('sumário e tabela cabem na leitura mobile sem cortar colunas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog/sac-ou-price');
  const toc = page.getByRole('navigation', { name: 'Neste artigo' });
  await expect(toc).toBeVisible();
  const table = page.getByRole('table', { name: /comparação.*400 mil/i });
  const scroll = table.locator('..');
  await expect(scroll).toHaveAttribute('tabindex', '0');
  expect(await scroll.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
  const box = await scroll.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('links editoriais permanecem legíveis no tema escuro', async ({ page }) => {
  await page.goto('/blog/sac-ou-price');
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const links = await page.locator('article a:not(.group\\/button)').all();
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    const contrast = await link.evaluate((element) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      const ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1, 1);
      for (const ancestor of ancestors) {
        ctx.fillStyle = getComputedStyle(ancestor).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
      }
      const bg = ctx.getImageData(0, 0, 1, 1).data.slice(0, 3);
      ctx.fillStyle = getComputedStyle(element).color;
      ctx.fillRect(0, 0, 1, 1);
      const fg = ctx.getImageData(0, 0, 1, 1).data.slice(0, 3);
      const luminance = (rgb: Uint8ClampedArray) => {
        const [r, g, b] = Array.from(rgb, (v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const a = luminance(bg), b = luminance(fg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast, await link.innerText()).toBeGreaterThanOrEqual(4.5);
  }
});
