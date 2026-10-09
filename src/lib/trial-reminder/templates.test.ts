import { describe, expect, it } from 'vitest';
import { trialReminderEmail } from './templates';

describe('trial activation invitation', () => {
  it('links to explicit activation, describes the reopened window and escapes the name', () => {
    const email = trialReminderEmail({ name: '<img src=x>', appUrl: 'https://amortiza.me' });
    expect(email.html).toContain('https://amortiza.me/perfil');
    expect(email.html).not.toContain('<img src=x>');
    expect(email.text).toContain('48 horas');
    expect(email.text).toContain('7 dias');
    expect(email.text).toContain('sem cartão');
    expect(email.text).toContain('sem cobrança automática');
  });
});
