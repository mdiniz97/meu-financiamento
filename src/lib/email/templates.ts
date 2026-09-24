export interface DunningReminderInput {
  name: string;
  valueCents: number | null;
  dueDate: Date | null;
  invoiceUrl: string | null;
  graceUntil: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const PRODUCT = 'amortiza.me';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

export function dunningReminderEmail(input: DunningReminderInput): RenderedEmail {
  const firstName = escapeHtml(input.name.trim().split(/\s+/)[0] || input.name);

  const valueLine = input.valueCents === null ? null : formatBRL(input.valueCents);
  const dueLine = input.dueDate === null ? null : formatDate(input.dueDate);
  const deadline = formatDate(input.graceUntil);

  const detailParts: string[] = [];
  if (valueLine) detailParts.push(`Valor: ${valueLine}`);
  if (dueLine) detailParts.push(`Vencimento: ${dueLine}`);

  const htmlParts = [
    `<p>Olá, ${firstName}.</p>`,
    `<p>Não identificamos o pagamento da sua assinatura do ${PRODUCT}.</p>`,
  ];
  if (detailParts.length > 0) {
    htmlParts.push(`<p>${detailParts.join('<br>')}</p>`);
  }
  htmlParts.push(`<p>Seu acesso continua ativo até <strong>${deadline}</strong>.</p>`);
  if (input.invoiceUrl) {
    const url = escapeHtml(input.invoiceUrl);
    htmlParts.push(`<p><a href="${url}">Pagar agora</a></p>`);
    htmlParts.push(`<p>Link direto: ${url}</p>`);
  }
  htmlParts.push('<p>Se o pagamento já foi feito, ignore este e-mail.</p>');
  htmlParts.push(`<p>Equipe ${PRODUCT}</p>`);

  const textParts = [
    `Olá, ${input.name}.`,
    `Não identificamos o pagamento da sua assinatura do ${PRODUCT}.`,
  ];
  if (valueLine) textParts.push(`Valor: ${valueLine}`);
  if (dueLine) textParts.push(`Vencimento: ${dueLine}`);
  textParts.push(`Seu acesso continua ativo até ${deadline}.`);
  if (input.invoiceUrl) textParts.push(`Pagar agora: ${input.invoiceUrl}`);
  textParts.push('Se o pagamento já foi feito, ignore este e-mail.');
  textParts.push(`Equipe ${PRODUCT}`);

  return {
    subject: `Fatura em aberto na ${PRODUCT}`,
    html: htmlParts.join('\n'),
    text: textParts.join('\n'),
  };
}

export { escapeHtml };
