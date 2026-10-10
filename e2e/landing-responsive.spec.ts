import { expect, test } from '@playwright/test';

test('tablet uses only the mobile public navigation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');
  const header = page.locator('header').first();
  await expect(header.getByRole('button', { name: /abrir menu/i })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Custos da compra', exact: true })).toBeHidden();
});

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

const ROUTES = ['/', '/negociacao'];
const WIDTHS = [320, 375, 414, 768, 900, 1024];

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`sem scroll horizontal: ${route} @${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      await page.waitForTimeout(400);
      const { scrollW, innerW, scrollers } = await page.evaluate(() => {
        const innerW = window.innerWidth;
        const scrollers: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          const ox = getComputedStyle(el).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
            scrollers.push(String(el.className).slice(0, 60));
          }
        }
        return { scrollW: document.documentElement.scrollWidth, innerW, scrollers: scrollers.slice(0, 8) };
      });
      expect(scrollers, `scroll horizontal interno: ${scrollers.join(' | ')}`).toEqual([]);
      expect(scrollW).toBeLessThanOrEqual(innerW + 1);
    });
  }
}
