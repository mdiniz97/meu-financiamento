import { expect, test } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

for (const width of [320, 375, 414]) {
  test(`landing não estoura horizontalmente (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(600);
    const { scrollW, innerW, scrollers } = await page.evaluate(() => {
      const innerW = window.innerWidth;
      const scrollers: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
          scrollers.push(String(el.className).slice(0, 60));
        }
      }
      return { scrollW: document.documentElement.scrollWidth, innerW, scrollers: scrollers.slice(0, 8) };
    });
    expect(scrollers, `scroll horizontal interno: ${scrollers.join(' | ')}`).toEqual([]);
    expect(scrollW).toBeLessThanOrEqual(innerW + 1);
  });
}
