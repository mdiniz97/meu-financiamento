import { isEmailEnabled } from './config';
import { sendEmail } from './client';
import { welcomeEmail } from './templates';

/** Bônus concedido no cadastro; o mesmo valor vai para o e-mail. */
export const WELCOME_BONUS_CREDITS = 2;

export interface WelcomeUser {
  name: string;
  email: string;
}

/**
 * Boas-vindas best-effort, compartilhado pelos dois caminhos de cadastro
 * (e-mail/senha e Google). Nunca lança: conta já criada não pode falhar por
 * causa de e-mail. Retorna `true` só quando o Resend aceitou a mensagem.
 */
export async function sendWelcomeEmail(user: WelcomeUser): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  try {
    const rendered = welcomeEmail({
      name: user.name,
      credits: WELCOME_BONUS_CREDITS,
      appUrl: process.env.APP_URL,
    });
    await sendEmail({ to: user.email, ...rendered });
    return true;
  } catch (e) {
    console.warn(`[email] falha ao enviar boas-vindas para ${user.email}: ${String(e)}`);
    return false;
  }
}
