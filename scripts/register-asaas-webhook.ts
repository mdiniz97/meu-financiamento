import { loadEnvConfig } from '@next/env';
import { asaasFetch } from '../src/lib/payments/asaas/client';
import { getAsaasConfig } from '../src/lib/payments/asaas/config';

loadEnvConfig(process.cwd());

// Lista de eventos = spec §7.2
// (docs/superpowers/specs/2026-09-13-assinaturas-asaas-design.md).
// Somente eventos que o endpoint trata; não adicionar famílias fora do escopo.
const EVENTS = [
  'CHECKOUT_PAID',
  'CHECKOUT_CANCELED',
  'CHECKOUT_EXPIRED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
  'PAYMENT_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_UPDATED',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
];

async function main() {
  const cfg = getAsaasConfig();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3012';

  // DTO exato: .opencode/skills/asaas-payments-expert/references/06-webhooks.md §2.1
  // (`WebhookConfigSaveRequestDTO`). No OpenAPI todos os campos constam em
  // `required`, por isso o corpo envia o conjunto completo — não inventar campos.
  // `sendType: SEQUENTIALLY` preserva a ordem (SaaS de assinaturas, §2.2).
  // `email` recebe alertas de penalização/fila pausada (§2.1, §3.3).
  const res = await asaasFetch<{ id: string }>(cfg, '/webhooks', {
    method: 'POST',
    body: {
      name: 'amortiza-assinaturas',
      url: `${appUrl}/api/asaas/webhook`,
      email: process.env.WEBHOOK_ADMIN_EMAIL ?? 'dev@example.com',
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: cfg.webhookToken,
      sendType: 'SEQUENTIALLY',
      events: EVENTS,
    },
  });

  console.log('webhook criado:', res.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
