import { describe, expect, it } from 'vitest';
import { dunningReminderEmail } from './templates';

const base = {
  name: 'Maria',
  valueCents: 4900,
  dueDate: new Date('2026-09-10T00:00:00Z'),
  invoiceUrl: 'https://asaas.com/i/abc',
  graceUntil: new Date('2026-09-15T00:00:00Z'),
};

describe('dunningReminderEmail', () => {
  it('gera assunto, html e texto com valor, vencimento, link e prazo', () => {
    const out = dunningReminderEmail(base);

    expect(out.subject).toContain('amortiza.me');
    expect(out.html).toContain('Maria');
    expect(out.html).toContain('R$ 49,00');
    expect(out.html).toContain('10/09/2026');
    expect(out.html).toContain('https://asaas.com/i/abc');
    expect(out.html).toContain('15/09/2026');
    expect(out.text).toContain('R$ 49,00');
    expect(out.text).toContain('https://asaas.com/i/abc');
  });

  it('degrada sem valor, sem vencimento e sem link', () => {
    const out = dunningReminderEmail({
      ...base,
      valueCents: null,
      dueDate: null,
      invoiceUrl: null,
    });

    expect(out.html).toContain('Maria');
    expect(out.html).toContain('15/09/2026');
    expect(out.html).not.toContain('undefined');
    expect(out.html).not.toContain('null');
    expect(out.text).not.toContain('undefined');
  });
});
