import { scheduleInvoiceOnce } from '../src/lib/payments/asaas/invoice';

/**
 * NÃO usa `loadEnvConfig`: o `dotenv-expand` do Next expande o `$` inicial da
 * chave Asaas (`$aact_prod_...`) para vazio. Exporte as variáveis no shell:
 *
 *   export ASAAS_API_KEY="$(awk -F'"' '/^ASAAS_API_KEY=/{print $2}' .env.local | tail -1)"
 *   export ASAAS_BASE_URL=https://api.asaas.com/v3 ASAAS_ENV=production
 *   export ASAAS_WEBHOOK_AUTH_TOKEN=...
 *   export ASAAS_INVOICE_...
 *
 * (Em produção o Railway injeta direto, então esse problema não existe lá.)
 */

/**
 * Emissão retroativa/manual da NFS-e de uma compra de créditos já paga.
 * Usa o mesmo caminho do webhook (`scheduleInvoiceOnce`), que consulta antes
 * de criar — rodar duas vezes não duplica a nota.
 *
 *   tsx scripts/emit-credit-invoice.ts <paymentId> <valor> <YYYY-MM-DD> [purchaseId]
 *
 * Exige as mesmas variáveis do app (ASAAS_*, ASAAS_INVOICE_*).
 */
async function main() {
  const [paymentId, rawValue, effectiveDate, purchaseId] = process.argv.slice(2);
  const value = Number(rawValue);
  if (!paymentId || !Number.isFinite(value) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate ?? '')) {
    throw new Error(
      'uso: tsx scripts/emit-credit-invoice.ts <paymentId> <valor> <YYYY-MM-DD> [purchaseId]'
    );
  }

  const result = await scheduleInvoiceOnce({
    paymentId,
    value,
    effectiveDate,
    serviceDescription: 'Licenciamento de uso de software amortiza.me — compra avulsa de créditos.',
    observations: `Compra ${purchaseId ?? '(manual)'}. Valor: R$ ${value.toFixed(2)}.`,
  });

  console.log(
    result
      ? `nota agendada: ${result.id} (${result.status ?? 'sem status'})`
      : 'já existia nota para esse pagamento — nada criado'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
