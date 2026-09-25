import { test, expect } from '@playwright/test';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}

test('signup claim queues one conversion but stays pending without Google callback', async ({ page }) => {
  let claims = 0;
  let acknowledgements = 0;
  await page.route('**/api/ads/signup-conversion/claim', async (route) => {
    claims++;
    if (claims > 1) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ json: {
      transactionId: 'TID_42',
      claimToken: '611a98f0-bb03-447e-a0e5-e55492c60c4f',
    } });
  });
  await page.route('**/api/ads/signup-conversion/ack', async (route) => {
    acknowledgements++;
    await route.fulfill({ json: { acknowledged: true } });
  });
  await page.route('**/gtag/js*', (route) => route.fulfill({ status: 200, body: '' }));

  await page.goto('/cookies');
  await page.waitForFunction(() =>
    (window as Window & { dataLayer?: IArguments[] }).dataLayer
      ?.some((args) => args[0] === 'event' && args[1] === 'conversion'),
    null,
    { timeout: 10_000 }
  );
  const conversions = await page.evaluate(() =>
    (window as Window & { dataLayer?: IArguments[] }).dataLayer
      ?.filter((args) => args[0] === 'event' && args[1] === 'conversion')
      .map((args) => args[2] as { send_to: string; value: number; currency: string; transaction_id: string }) ?? []
  );
  expect(conversions).toEqual([expect.objectContaining({
    send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
    value: 1.0,
    currency: 'BRL',
    transaction_id: 'TID_42',
  })]);
  expect(claims).toBeGreaterThan(0);
  expect(acknowledgements).toBe(0);
});
