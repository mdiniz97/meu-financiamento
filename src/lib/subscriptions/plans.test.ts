import { expect, it } from 'vitest';
import { subscriptionPrice, requireBillingCycle } from './plans';

it('resolves prices from server catalog and denies unknown cycles', () => {
  const catalog = { priceCents: 11990, monthlyPriceCents: 1890 };
  expect(subscriptionPrice(catalog, 'MONTHLY')).toBe(1890);
  expect(subscriptionPrice(catalog, 'YEARLY')).toBe(11990);
  expect(() => requireBillingCycle('WEEKLY')).toThrow();
  expect(() => subscriptionPrice({ ...catalog, monthlyPriceCents: null }, 'MONTHLY')).toThrow();
});
