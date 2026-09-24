import { escapeHtml } from './html';
import { emailDetails, renderEmailLayout } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const PRODUCT = 'amortiza.me';
const DEFAULT_APP_URL = 'https://amortiza.me';

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** `Intl` injeta NBSP (U+00A0) no pt-BR; normalizamos para espaço comum. */
function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/\u00A0/g, ' ');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export interface DunningReminderInput {
  name: string;
  valueCents: number | null;
  dueDate: Date | null;
  invoiceUrl: string | null;
  graceUntil: Date;
}

export function dunningReminderEmail(input: DunningReminderInput): RenderedEmail {
  const firstName = escapeHtml(firstNameOf(input.name));
  const valueLine = input.valueCents === null ? null : formatBRL(input.valueCents);
  const dueLine = input.dueDate === null ? null : formatDate(input.dueDate);
  const deadline = formatDate(input.graceUntil);

  const rows = [
    ...(valueLine ? [{ label: 'Valor', value: valueLine }] : []),
    ...(dueLine ? [{ label: 'Vencimento', value: dueLine }] : []),
  ];

  const html = renderEmailLayout({
    preheader: `Regularize para não perder o acesso até ${deadline}.`,
    title: 'Fatura em aberto',
    contentHtml: [
      `<p style="margin:0 0 16px 0;">Olá, ${firstName}. Não identificamos o pagamento da sua assinatura do ${PRODUCT}.</p>`,
      rows.length > 0 ? emailDetails(rows) : '',
      `<p style="margin:16px 0 0 0;">Seu acesso continua ativo até <strong>${deadline}</strong>. Depois dessa data, a assinatura é cancelada automaticamente.</p>`,
      input.invoiceUrl
        ? `<p style="margin:16px 0 0 0;font-size:14px;color:#71717a;">Link direto: ${escapeHtml(input.invoiceUrl)}</p>`
        : '',
      '<p style="margin:16px 0 0 0;">Se o pagamento já foi feito, é só ignorar este e-mail.</p>',
    ]
      .filter(Boolean)
      .join('\n'),
    cta: input.invoiceUrl ? { label: 'Pagar agora', url: input.invoiceUrl } : undefined,
    footerNote: 'Este aviso é enviado automaticamente sobre sua assinatura.',
  });

  const textParts = [
    `Olá, ${input.name}.`,
    `Não identificamos o pagamento da sua assinatura do ${PRODUCT}.`,
  ];
  if (valueLine) textParts.push(`Valor: ${valueLine}`);
  if (dueLine) textParts.push(`Vencimento: ${dueLine}`);
  textParts.push(`Seu acesso continua ativo até ${deadline}.`);
  textParts.push(`Depois dessa data, a assinatura é cancelada automaticamente.`);
  if (input.invoiceUrl) textParts.push(`Pagar agora: ${input.invoiceUrl}`);
  textParts.push('Se o pagamento já foi feito, é só ignorar este e-mail.');
  textParts.push(`Equipe ${PRODUCT}`);

  return {
    subject: `Fatura em aberto na ${PRODUCT}`,
    html,
    text: textParts.join('\n'),
  };
}

export interface WelcomeInput {
  name: string;
  credits: number;
  appUrl?: string;
}

export function welcomeEmail(input: WelcomeInput): RenderedEmail {
  const firstName = escapeHtml(firstNameOf(input.name));
  const appUrl = input.appUrl ?? DEFAULT_APP_URL;
  const creditsLabel = input.credits === 1 ? '1 crédito' : `${input.credits} créditos`;

  const html = renderEmailLayout({
    preheader: `Sua conta está pronta, com ${creditsLabel} de bônus.`,
    title: `Bem-vindo ao ${PRODUCT}`,
    contentHtml: [
      `<p style="margin:0 0 16px 0;">Olá, ${firstName}! Sua conta está pronta.</p>`,
      `<p style="margin:0 0 16px 0;">Creditamos <strong>${escapeHtml(creditsLabel)}</strong> de bônus para você começar sem pagar nada.</p>`,
      '<p style="margin:0;">Qualquer dúvida, é só responder este e-mail.</p>',
    ].join('\n'),
    cta: { label: 'Começar agora', url: appUrl },
    footerNote: 'Você recebeu este e-mail por ter criado uma conta.',
  });

  const text = [
    `Olá, ${input.name}! Sua conta no ${PRODUCT} está pronta.`,
    `Creditamos ${creditsLabel} de bônus para você começar sem pagar nada.`,
    `Começar agora: ${appUrl}`,
    'Qualquer dúvida, é só responder este e-mail.',
    `Equipe ${PRODUCT}`,
  ].join('\n');

  return { subject: `Bem-vindo ao ${PRODUCT}`, html, text };
}
