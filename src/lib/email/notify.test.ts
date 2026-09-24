import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isEmailEnabled: vi.fn(),
  sendEmail: vi.fn(),
  welcomeEmail: vi.fn(),
}));

vi.mock('./config', () => ({ isEmailEnabled: mocks.isEmailEnabled }));
vi.mock('./client', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('./templates', () => ({ welcomeEmail: mocks.welcomeEmail }));

import { WELCOME_BONUS_CREDITS, sendWelcomeEmail } from './notify';

beforeEach(() => {
  mocks.isEmailEnabled.mockReset().mockReturnValue(true);
  mocks.sendEmail.mockReset().mockResolvedValue({ id: 'email_1' });
  mocks.welcomeEmail.mockReset().mockReturnValue({ subject: 'S', html: '<p>h</p>', text: 't' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sendWelcomeEmail', () => {
  it('envia com o bônus padrão e retorna true', async () => {
    const sent = await sendWelcomeEmail({ name: 'Maria', email: 'm@e.com' });

    expect(sent).toBe(true);
    expect(mocks.welcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', credits: WELCOME_BONUS_CREDITS })
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'm@e.com', subject: 'S' })
    );
  });

  it('não envia e retorna false quando desabilitado', async () => {
    mocks.isEmailEnabled.mockReturnValue(false);

    expect(await sendWelcomeEmail({ name: 'Maria', email: 'm@e.com' })).toBe(false);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('falha de envio não propaga e retorna false', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('Resend 500'));

    await expect(sendWelcomeEmail({ name: 'Maria', email: 'm@e.com' })).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('falha ao enviar boas-vindas')
    );
  });
});
