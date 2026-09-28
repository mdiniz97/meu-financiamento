import { test, expect } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

test('link de e-mail remove token antes de carregar tela e nunca resgata por GET', async ({ page }) => {
  const token = 'x'.repeat(43);
  const response = await page.goto(`/resgatar/link?t=${token}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\?login=1&next=%2Fresgatar$/);
  expect(page.url()).not.toContain(token);
  expect(await page.locator('body').innerText()).not.toContain(token);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'activation_bonus_token')?.httpOnly).toBe(true);
});
