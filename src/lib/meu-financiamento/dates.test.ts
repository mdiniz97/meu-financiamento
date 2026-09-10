import { expect, it } from 'vitest';
import { addMonthsISO } from './dates';

it('sem dia de vencimento, preserva o dia da data (comportamento atual)', () => {
  expect(addMonthsISO('2026-09-10', 1)).toBe('2026-10-10');
  expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
});

it('com dia de vencimento, usa o dia informado no mês-alvo', () => {
  expect(addMonthsISO('2026-09-10', 1, 5)).toBe('2026-10-05');
  expect(addMonthsISO('2026-09-10', 2, 31)).toBe('2026-11-30');
});

it('faz clamp para o último dia quando o dia não existe no mês (31 em fevereiro)', () => {
  expect(addMonthsISO('2026-01-10', 1, 31)).toBe('2026-02-28');
  expect(addMonthsISO('2028-01-10', 1, 31)).toBe('2028-02-29');
  expect(addMonthsISO('2026-03-10', 1, 31)).toBe('2026-04-30');
});

it('dia de vencimento fora de 1..31 é limitado à faixa válida', () => {
  expect(addMonthsISO('2026-09-10', 1, 0)).toBe('2026-10-01');
  expect(addMonthsISO('2026-09-10', 1, 40)).toBe('2026-10-31');
  expect(addMonthsISO('2026-09-10', 1, Number.NaN)).toBe('2026-10-10');
});
