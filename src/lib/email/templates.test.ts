import { describe, expect, it } from 'vitest';
import { activationBonusEmail, dunningReminderEmail, welcomeEmail } from './templates';

const base = {
  name: 'Maria',
  valueCents: 4900,
  dueDate: new Date('2026-09-10T00:00:00Z'),
  invoiceUrl: 'https://asaas.com/i/abc',
  graceUntil: new Date('2026-09-15T00:00:00Z'),
};

describe('dunningReminderEmail', () => {
  it('mantém motivo específico no rodapé', () => {
    const { html } = dunningReminderEmail(base);
    expect(html).toContain('Este aviso é enviado automaticamente sobre sua assinatura.');
    expect(html).not.toContain('porque tem uma conta');
  });
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

describe('welcomeEmail', () => {
  it('traz somente um motivo de recebimento', () => {
    const { html } = welcomeEmail({ name: 'Ana', credits: 5 });
    expect(html.match(/Você recebeu este e-mail/g)).toHaveLength(1);
  });
  it('saúda pelo primeiro nome, cita os créditos de bônus e o link do app', () => {
    const out = welcomeEmail({ name: 'Marcos Paulo Silva', credits: 5 });

    expect(out.subject).toContain('amortiza.me');
    expect(out.html).toContain('Marcos');
    expect(out.html).not.toContain('Paulo Silva');
    expect(out.html).toContain('5 créditos');
    expect(out.html).toContain('https://amortiza.me');
    expect(out.text).toContain('5 créditos');
  });

  it('usa singular para um crédito', () => {
    const out = welcomeEmail({ name: 'Ana', credits: 1 });
    expect(out.html).toContain('1 crédito');
    expect(out.html).not.toContain('1 créditos');
  });

  it('escapa o nome (não injeta HTML)', () => {
    const out = welcomeEmail({ name: '<script>alert(1)</script>', credits: 2 });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('respeita appUrl customizada', () => {
    const out = welcomeEmail({ name: 'Ana', credits: 2, appUrl: 'https://staging.exemplo.com' });
    expect(out.html).toContain('https://staging.exemplo.com');
  });
});

describe('activationBonusEmail', () => {
  const input = {
    name: 'Ana Silva',
    redeemUrl: 'https://amortiza.me/resgatar/link?t=token&source=email',
    preferencesUrl: 'https://amortiza.me/perfil',
  };

  it('convida quem ainda não salvou simulação, com link seguro e opção de recusa', () => {
    const offer = activationBonusEmail({ ...input, variant: 'first_simulation' });
    expect(offer.subject).toContain('2 créditos');
    expect(offer.html).toContain('ainda não salvou uma simulação');
    expect(offer.html).toContain('href="https://amortiza.me/resgatar/link?t=token&amp;source=email"');
    expect(offer.html).toContain('href="https://amortiza.me/perfil"');
    expect(offer.text).toContain('2 créditos');
    expect(offer.text).toContain('/resgatar/link?t=token&source=email');
    expect(offer.text).toContain('https://amortiza.me/perfil');
    expect(offer.html).not.toContain('R$');
  });

  it('reconhece simulação salva com mensagem diferente', () => {
    const first = activationBonusEmail({ ...input, variant: 'first_simulation' });
    const returning = activationBonusEmail({ ...input, variant: 'keep_exploring' });
    expect(returning.html).toContain('já fez simulações');
    expect(returning.text).not.toBe(first.text);
    expect(returning.text).toContain('2 créditos');
  });

  it('escapa nome exibido no HTML', () => {
    const offer = activationBonusEmail({ ...input, name: '<script>alert(1)</script>', variant: 'first_simulation' });
    expect(offer.html).not.toContain('<script>');
    expect(offer.html).toContain('&lt;script&gt;');
  });
});

describe('dunningReminderEmail — ordem do link', () => {
  it('mostra o link em texto DEPOIS do botão "Pagar agora"', () => {
    const { html } = dunningReminderEmail(base);
    const botao = html.indexOf('Pagar agora');
    const linkTexto = html.indexOf('copie e cole');
    expect(botao).toBeGreaterThan(-1);
    expect(linkTexto).toBeGreaterThan(botao);
  });

  it('não mostra botão nem link quando não há invoiceUrl', () => {
    const { html } = dunningReminderEmail({ ...base, invoiceUrl: null });
    expect(html).not.toContain('Pagar agora');
    expect(html).not.toContain('copie e cole');
  });
});
