import { loadEnvConfig } from '@next/env';
import { getAsaasConfig } from '../src/lib/payments/asaas/config';
import { registerAsaasWebhook } from '../src/lib/payments/asaas/webhook-registration';

loadEnvConfig(process.cwd());

async function main() {
  const cfg = getAsaasConfig();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3012';

  const { id, action } = await registerAsaasWebhook(cfg, {
    appUrl,
    adminEmail: process.env.WEBHOOK_ADMIN_EMAIL ?? 'dev@example.com',
  });

  console.log(action === 'created' ? `webhook criado: ${id}` : `webhook atualizado: ${id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
