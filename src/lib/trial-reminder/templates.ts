import { escapeHtml } from '@/lib/email/html';
import { renderEmailLayout } from '@/lib/email/layout';

export function trialReminderEmail(input: { name: string; appUrl: string }) {
  const origin = new URL(input.appUrl).origin;
  const greeting = `Olá, ${input.name.trim().split(/\s+/)[0] || 'por aí'}!`;
  const paragraphs = [
    'Você criou sua conta, mas ainda não experimentou tudo que o amortiza.me pode fazer pelo seu financiamento.',
    'Reabrimos sua oferta por mais 48 horas. Ative 7 dias grátis do Plano Ilimitado, sem cartão e sem cobrança automática.',
    'Compare SAC e PRICE, explore estratégias de amortização e planeje sua quitação com simulações ilimitadas.',
    'O teste só começa quando você confirmar a ativação no seu perfil. Os 7 dias contam a partir desse momento.',
  ];
  return {
    subject: 'Seus 7 dias grátis ainda estão esperando por você',
    html: renderEmailLayout({
      title: 'Seu financiamento merece um plano. Comece grátis.',
      preheader: 'Mais 48 horas para ativar seu teste do Ilimitado. Sem cartão.',
      contentHtml: [greeting, ...paragraphs].map(p =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(p)}</p>`).join(''),
      cta: { label: 'Ativar meus 7 dias grátis', url: `${origin}/perfil` },
      postCtaHtml: `<p>Você pode recusar ofertas nas <a href="${escapeHtml(`${origin}/perfil`)}">preferências do perfil</a>.</p>`,
      footerNote: 'Convite para o teste grátis do amortiza.me.',
    }),
    text: [greeting, ...paragraphs, `Ativar meus 7 dias grátis: ${origin}/perfil`,
      `Recusar ofertas: ${origin}/perfil`].join('\n\n'),
  };
}
