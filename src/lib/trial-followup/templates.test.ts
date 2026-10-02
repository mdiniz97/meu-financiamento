import { expect, it } from 'vitest';
import { trialFollowupEmail } from './templates';

it('renders distinct messages and destinations, escaping the recipient name', () => {
  const input = { name: '<script>Ana</script>', appUrl: 'https://amortiza.me', promotionalPriceCents: 11990 };
  const first = trialFollowupEmail({ ...input, stage: 'day_1' });
  const seventh = trialFollowupEmail({ ...input, stage: 'day_7' });
  const last = trialFollowupEmail({ ...input, stage: 'day_30' });
  expect(first.text).toContain('199,90');
  expect(first.text).toContain('119,90');
  expect(first.text).toContain('/assinar');
  expect(seventh.subject).not.toBe(first.subject);
  expect(last.text).toContain('Já pagou a nova parcela? Fez alguma amortização?');
  expect(last.text).toContain('/meu-financiamento');
  for (const message of [first, seventh, last]) {
    expect(message.html).not.toContain('<script>');
    expect(message.text).toContain('/perfil');
  }
});
