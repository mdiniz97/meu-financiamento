export type AsaasEnv = 'sandbox' | 'production';
export interface AsaasConfig {
  baseUrl: string;
  apiKey: string;
  webhookToken: string;
  env: AsaasEnv;
}

export function getAsaasConfig(): AsaasConfig {
  const env = (process.env.ASAAS_ENV ?? 'sandbox') as AsaasEnv;
  const baseUrl =
    process.env.ASAAS_BASE_URL ??
    (env === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  const apiKey = process.env.ASAAS_API_KEY ?? '';
  const webhookToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN ?? '';

  if (!apiKey) throw new Error('ASAAS_API_KEY ausente');
  if (env === 'production' && apiKey.startsWith('$aact_hmlg_')) {
    throw new Error('chave de sandbox não pode ser usada em produção');
  }
  if (webhookToken.length < 32) {
    throw new Error('ASAAS_WEBHOOK_AUTH_TOKEN precisa de ao menos 32 caracteres');
  }
  return { baseUrl, apiKey, webhookToken, env };
}
