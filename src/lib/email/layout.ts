import { escapeHtml } from './html';

/**
 * Layout institucional dos e-mails. Regras que os clientes de e-mail impõem e
 * que o app não tem: tabelas em vez de flex/grid, estilo inline em vez de
 * classes, nada de `<style>`.
 *
 * A marca tem `--radius: 0`, então **nada** de border-radius aqui — é o traço
 * visual mais fácil de perder ao converter a UI para e-mail.
 */
const APP_URL = 'https://amortiza.me';
const LOGO_URL = `${APP_URL}/brand/logo.png`;
const PRIMARY = '#820ad1';
const INK = '#0a0a0a';
const MUTED = '#71717a';
const BORDER = '#dcdcdc';
const PAGE_BG = '#f4f4f5';
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const COMPANY = 'SAFE CODE DESENVOLVIMENTO DE SOFTWARES LTDA';
const CNPJ = '54.569.947/0001-47';

export interface EmailButtonInput {
  label: string;
  url: string;
}

/** Botão como `<a>` dentro de célula: `<button>` não é confiável em e-mail. */
export function emailButton({ label, url }: EmailButtonInput): string {
  const href = escapeHtml(url);
  const text = escapeHtml(label);
  return [
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:24px 0;">`,
    `<tr><td bgcolor="${PRIMARY}" style="background-color:${PRIMARY};">`,
    `<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${text}</a>`,
    `</td></tr></table>`,
  ].join('');
}

export interface EmailDetail {
  label: string;
  value: string;
}

export function emailDetails(rows: EmailDetail[]): string {
  const cells = rows
    .map(
      (row) =>
        `<tr>` +
        `<td style="padding:6px 16px 6px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${MUTED};white-space:nowrap;">${escapeHtml(row.label)}</td>` +
        `<td style="padding:6px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};font-weight:600;">${escapeHtml(row.value)}</td>` +
        `</tr>`
    )
    .join('');
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 8px 0;">${cells}</table>`;
}

export interface LayoutInput {
  contentHtml: string;
  title?: string;
  preheader?: string;
  cta?: EmailButtonInput;
  /** Conteúdo renderizado DEPOIS do CTA (ex.: o link em texto puro). */
  postCtaHtml?: string;
  /** Parágrafos extras no rodapé (ex.: motivo do recebimento). */
  footerNote?: string;
}

export function renderEmailLayout(input: LayoutInput): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;text-indent:-9999px;opacity:0;">${escapeHtml(input.preheader)}</div>`
    : '';

  const title = input.title
    ? `<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${escapeHtml(input.title)}</h1>`
    : '';

  const cta = input.cta ? emailButton(input.cta) : '';

  const footerNote = input.footerNote
    ? `<p style="margin:0 0 8px 0;">${escapeHtml(input.footerNote)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>amortiza.me</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;">
<tr><td style="padding:0 0 20px 0;">
<a href="${APP_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" width="170" height="36" alt="amortiza.me" style="display:block;width:170px;height:36px;border:0;"></a>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid ${BORDER};padding:32px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK};">
${title}
${input.contentHtml}
${cta}
${input.postCtaHtml ?? ''}
</td></tr>
<tr><td style="padding:24px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
${footerNote}
<p style="margin:0 0 8px 0;">${COMPANY} &middot; CNPJ ${CNPJ}</p>
<p style="margin:0;">Você recebeu este e-mail porque tem uma conta no amortiza.me.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export const emailBrand = { APP_URL, LOGO_URL, PRIMARY, INK, MUTED, BORDER, PAGE_BG, FONT, COMPANY, CNPJ };
