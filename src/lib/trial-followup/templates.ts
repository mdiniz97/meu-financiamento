import { escapeHtml } from '@/lib/email/html';
import { renderEmailLayout } from '@/lib/email/layout';
import { formatBRL } from '@/lib/utils';
import type { FollowupStage } from './schedule';

export function trialFollowupEmail(input: {
  stage: FollowupStage; name: string; appUrl: string; promotionalPriceCents: number;
}): { subject: string; html: string; text: string } {
  const origin = new URL(input.appUrl).origin;
  const price = formatBRL(input.promotionalPriceCents / 100);
  const offer = input.promotionalPriceCents === 11990
    ? `De R$ 199,90 por ${price}/ano.` : `Plano Ilimitado por ${price}/ano.`;
  const messages = {
    day_1: {
      subject: 'Seu teste terminou. Continue com o Ilimitado',
      paragraphs: ['Seu teste grátis de 7 dias terminou. Não houve cobrança automática e seus créditos continuam disponíveis.',
        `Continue com simulações ilimitadas, ferramentas exclusivas e exportação em PDF. ${offer}`,
        'A assinatura é opcional: você só paga se decidir contratar.'],
      label: 'Assinar Ilimitado', path: '/assinar',
    },
    day_7: {
      subject: 'Seu plano de quitação continua aqui',
      paragraphs: ['Que tal retomar o planejamento do seu financiamento?',
        'Volte ao amortiza.me para comparar estratégias, avaliar amortizações e planejar os próximos passos da quitação.',
        'Consulte seus créditos e os planos disponíveis no perfil.'],
      label: 'Voltar à plataforma', path: '/perfil',
    },
    day_30: {
      subject: 'Como está seu financiamento?',
      paragraphs: ['Já pagou a nova parcela? Fez alguma amortização?',
        'Registre as movimentações e atualize as informações do seu financiamento para acompanhar sua evolução com mais clareza.',
        'Use o amortiza.me para organizar os próximos passos. Recursos exclusivos exigem o plano Ilimitado.'],
      label: 'Revisar meu financiamento', path: '/meu-financiamento',
    },
  };
  const message = messages[input.stage];
  const greeting = `Olá, ${input.name.trim().split(/\s+/)[0] || 'por aí'}!`;
  const preference = `${origin}/perfil`;
  return {
    subject: message.subject,
    html: renderEmailLayout({
      title: message.subject,
      preheader: message.paragraphs[0],
      contentHtml: [greeting, ...message.paragraphs].map(value =>
        `<p style="margin:0 0 16px 0;">${escapeHtml(value)}</p>`).join(''),
      cta: { label: message.label, url: `${origin}${message.path}` },
      postCtaHtml: `<p>Você pode recusar ofertas nas <a href="${escapeHtml(preference)}">preferências do perfil</a>.</p>`,
      footerNote: 'Acompanhamento do seu teste grátis no amortiza.me.',
    }),
    text: [greeting, ...message.paragraphs, `${message.label}: ${origin}${message.path}`,
      `Recusar ofertas: ${preference}`].join('\n\n'),
  };
}
