import { asaasFetch } from './client';
import type { AsaasConfig } from './config';

// Lista de eventos = spec §7.2
// (docs/superpowers/specs/2026-09-13-assinaturas-asaas-design.md).
// Somente eventos que o endpoint trata; não adicionar famílias fora do escopo.
export const ASAAS_WEBHOOK_EVENTS = [
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
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_SYNCHRONIZED',
  'INVOICE_AUTHORIZED',
  'INVOICE_PROCESSING_CANCELLATION',
  'INVOICE_CANCELED',
  'INVOICE_CANCELLATION_DENIED',
  'INVOICE_ERROR',
] as const;

export interface AsaasWebhookDescriptor {
  id: string;
  url?: string | null;
}

export interface RegisterAsaasWebhookInput {
  appUrl: string;
  adminEmail: string;
  events?: readonly string[];
}

export type WebhookRegistrationAction = 'created' | 'updated';

export interface WebhookRegistrationResult {
  id: string;
  action: WebhookRegistrationAction;
}

function listWebhooks(payload: unknown): AsaasWebhookDescriptor[] {
  if (Array.isArray(payload)) return payload as AsaasWebhookDescriptor[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as AsaasWebhookDescriptor[];
  }
  return [];
}

/**
 * F2 — registro idempotente do webhook. Re-rodar para adicionar os `INVOICE_*`
 * não pode criar um webhook duplicado: procura por `url` iguais e, se existir,
 * atualiza via `PUT /v3/webhooks/{id}`; senão cria via `POST /v3/webhooks`.
 */
export async function registerAsaasWebhook(
  cfg: AsaasConfig,
  input: RegisterAsaasWebhookInput
): Promise<WebhookRegistrationResult> {
  const url = `${input.appUrl}/api/asaas/webhook`;

  // DTO exato: .opencode/skills/asaas-payments-expert/references/06-webhooks.md §2.1
  // (`WebhookConfigSaveRequestDTO`). No OpenAPI todos os campos constam em
  // `required`, por isso o corpo envia o conjunto completo — não inventar campos.
  // `sendType: SEQUENTIALLY` preserva a ordem (SaaS de assinaturas, §2.2).
  // `email` recebe alertas de penalização/fila pausada (§2.1, §3.3).
  const body = {
    name: 'amortiza-assinaturas',
    url,
    email: input.adminEmail,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: cfg.webhookToken,
    sendType: 'SEQUENTIALLY',
    events: input.events ?? ASAAS_WEBHOOK_EVENTS,
  };

  const listed = await asaasFetch<unknown>(cfg, '/webhooks');
  const existing = listWebhooks(listed).find((webhook) => webhook.url === url);

  if (existing) {
    await asaasFetch<{ id: string }>(cfg, `/webhooks/${existing.id}`, {
      method: 'PUT',
      body,
    });
    return { id: existing.id, action: 'updated' };
  }

  const created = await asaasFetch<{ id: string }>(cfg, '/webhooks', {
    method: 'POST',
    body,
  });
  return { id: created.id, action: 'created' };
}
