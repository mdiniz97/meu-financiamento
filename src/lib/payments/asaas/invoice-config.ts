export type EffectiveDatePeriod =
  | 'ON_PAYMENT_CONFIRMATION'
  | 'ON_PAYMENT_DUE_DATE'
  | 'BEFORE_PAYMENT_DUE_DATE'
  | 'ON_DUE_DATE_MONTH'
  | 'ON_NEXT_MONTH';

const EFFECTIVE_DATE_PERIODS: readonly EffectiveDatePeriod[] = [
  'ON_PAYMENT_CONFIRMATION',
  'ON_PAYMENT_DUE_DATE',
  'BEFORE_PAYMENT_DUE_DATE',
  'ON_DUE_DATE_MONTH',
  'ON_NEXT_MONTH',
];

export interface InvoiceSettingsTaxes {
  retainIss: boolean;
  iss: number;
  pis: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
}

export interface InvoiceSettingsBody {
  effectiveDatePeriod: EffectiveDatePeriod;
  /** Municípios com lista de serviços (ex.: Brasília) usam o `id` retornado por
   * `GET /v3/fiscalInfo/services`. Só um entre id e código é enviado. */
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName: string;
  taxes: InvoiceSettingsTaxes;
  nbsCode?: string;
  taxSituationCode?: string;
  taxClassificationCode?: string;
  operationIndicatorCode?: string;
  observations?: string;
}

/** NFS-e desligada por default: só habilita com o valor exato `true`. */
export function isInvoiceEnabled(): boolean {
  return process.env.ASAAS_INVOICE_ENABLED === 'true';
}

function envNumber(name: string): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function envBool(name: string): boolean {
  return process.env[name] === 'true';
}

function effectiveDatePeriod(): EffectiveDatePeriod {
  const raw = process.env.ASAAS_INVOICE_EFFECTIVE_PERIOD;
  if (!raw) return 'ON_PAYMENT_CONFIRMATION';
  if (!EFFECTIVE_DATE_PERIODS.includes(raw as EffectiveDatePeriod)) {
    throw new Error(
      `ASAAS_INVOICE_EFFECTIVE_PERIOD inválido: "${raw}" (esperado ${EFFECTIVE_DATE_PERIODS.join('|')})`
    );
  }
  return raw as EffectiveDatePeriod;
}

/** Campos de serviço municipal compartilhados por `invoiceSettings` e `POST /v3/invoices`. */
export interface InvoiceServiceFields {
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName: string;
}

/**
 * Municípios com lista usam `ASAAS_INVOICE_MUNICIPAL_SERVICE_ID`; sem lista,
 * usam `ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE`. O ID tem precedência.
 */
export function invoiceServiceFields(): InvoiceServiceFields {
  const id = process.env.ASAAS_INVOICE_MUNICIPAL_SERVICE_ID?.trim();
  const code = process.env.ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE?.trim();
  const name = process.env.ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME?.trim() ?? '';
  return id ? { municipalServiceId: id, municipalServiceName: name } : { municipalServiceCode: code ?? '', municipalServiceName: name };
}

/** Bloco `taxes` conforme a situação fiscal configurada no ambiente. */
export function invoiceTaxes(): InvoiceSettingsTaxes {
  return {
    retainIss: envBool('ASAAS_INVOICE_RETAIN_ISS'),
    iss: envNumber('ASAAS_INVOICE_ISS'),
    pis: envNumber('ASAAS_INVOICE_PIS'),
    cofins: envNumber('ASAAS_INVOICE_COFINS'),
    csll: envNumber('ASAAS_INVOICE_CSLL'),
    inss: envNumber('ASAAS_INVOICE_INSS'),
    ir: envNumber('ASAAS_INVOICE_IR'),
  };
}

/**
 * Monta o body de `POST /subscriptions/{id}/invoiceSettings`.
 * Exige `ASAAS_INVOICE_MUNICIPAL_SERVICE_ID` ou `..._CODE` quando habilitado —
 * falha no uso, nunca no import do módulo.
 */
/** `true` quando há serviço municipal configurado (id ou código). */
export function hasInvoiceService(): boolean {
  const service = invoiceServiceFields();
  return Boolean(service.municipalServiceId || service.municipalServiceCode);
}

export function invoiceSettingsBody(): InvoiceSettingsBody {
  const service = invoiceServiceFields();
  const hasService = Boolean(service.municipalServiceId || service.municipalServiceCode);
  if (isInvoiceEnabled() && !hasService) {
    throw new Error(
      'ASAAS_INVOICE_MUNICIPAL_SERVICE_ID ou ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE ausente com ASAAS_INVOICE_ENABLED=true'
    );
  }

  const body: InvoiceSettingsBody = {
    effectiveDatePeriod: effectiveDatePeriod(),
    ...service,
    taxes: invoiceTaxes(),
  };

  const optional: Array<[keyof InvoiceSettingsBody, string]> = [
    ['nbsCode', 'ASAAS_INVOICE_NBS_CODE'],
    ['taxSituationCode', 'ASAAS_INVOICE_TAX_SITUATION_CODE'],
    ['taxClassificationCode', 'ASAAS_INVOICE_TAX_CLASSIFICATION_CODE'],
    ['operationIndicatorCode', 'ASAAS_INVOICE_OPERATION_INDICATOR_CODE'],
    ['observations', 'ASAAS_INVOICE_OBSERVATIONS'],
  ];
  for (const [key, env] of optional) {
    const value = process.env[env]?.trim();
    if (value) (body as unknown as Record<string, unknown>)[key] = value;
  }

  return body;
}
