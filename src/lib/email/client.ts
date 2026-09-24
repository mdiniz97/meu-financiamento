import { getEmailConfig } from './config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export class EmailApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'EmailApiError';
  }
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envio transacional via API do Resend. `fetch` direto (sem SDK) para seguir o
 * padrão já usado no cliente da Asaas.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const cfg = getEmailConfig();
  const body: Record<string, unknown> = {
    from: cfg.from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.text) body.text = input.text;
  if (cfg.replyTo) body.reply_to = cfg.replyTo;

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new EmailApiError(`falha de rede ao enviar e-mail: ${String(e)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new EmailApiError(`Resend respondeu ${res.status}: ${detail.slice(0, 500)}`, res.status);
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: json.id ?? '' };
}
