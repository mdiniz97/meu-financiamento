export interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
}

/**
 * Envio é opt-in explícito: exige `EMAIL_ENABLED=true` **e** chave **e**
 * remetente. Sem isso o cron roda como antes (só log) em vez de tentar enviar
 * e falhar silenciosamente.
 */
export function isEmailEnabled(): boolean {
  if (process.env.EMAIL_ENABLED !== 'true') return false;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return Boolean(apiKey && from);
}

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada');
  if (!from) throw new Error('EMAIL_FROM não configurado');
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  return replyTo ? { apiKey, from, replyTo } : { apiKey, from };
}
