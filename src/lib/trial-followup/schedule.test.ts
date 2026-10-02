import { expect, it } from 'vitest';
import { dueStage } from './schedule';

it.each([
  [0, null], [1, 'day_1'], [1.99, 'day_1'], [2, null],
  [7, 'day_7'], [7.99, 'day_7'], [8, null],
  [30, 'day_30'], [30.99, 'day_30'], [31, null],
] as const)('chooses stage at %s days without accumulating missed emails', (days, wanted) => {
  const end = new Date('2026-10-01T12:00:00Z');
  expect(dueStage(end, new Date(end.getTime() + days * 86400000))).toBe(wanted);
});
