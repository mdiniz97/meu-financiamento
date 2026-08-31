import type { AmortSystem, ExtraPayment, LoanInput, RecurringExtra, Strategies } from './finance/types';
import { isRateKind, normalizeRate, type RateKind } from './finance/rates';
import { parseBRLToNumber, parseDecimal } from './utils';

const parseIntSafe = (s: string | undefined) => {
  if (s == null) return 0;
  const d = s.replace(/[^\d]/g, '');
  return d === '' ? 0 : Number(d);
};

export type ReduceMode = 'payment' | 'term';

export const NOVA_SIMULACAO_PREFILL_KEY = 'nova-simulacao-prefill';

export interface PortabilityForm {
  annualRate: string;
  annualRateKind: RateKind;
  bank: string;
}

export interface RecurringExtraForm {
  amount: string;
  every: string;
  startMonth: string;
  untilMonth: string;
}

export interface FormState {
  system: AmortSystem;
  principal: string;
  annualRate: string;
  annualRateKind: RateKind;
  months: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  lumpSum: ExtraPayment[];
  extraMonthlyPct: string;
  extraMonthlyPctStart: string;
  extraMonthlyPctUntil: string;
  fixedPaymentStart: string;
  fgtsAnnual: string;
  fgtsStartMonth: string;
  fgtsUntilMonth: string;
  recurringExtra: RecurringExtraForm | null;
  fixedPayment: string;
  fixedPaymentUntil: string;
  paySacParcela: boolean;
  reduceMode: ReduceMode;
  portability: PortabilityForm | null;
}

export const BANKS = ['Caixa', 'Itaú', 'Santander', 'Bradesco', 'BB', 'Outros'];

export const DEFAULT_FORM: FormState = {
  system: 'PRICE',
  principal: '1000000',
  annualRate: '10.5',
  annualRateKind: 'effective-annual',
  months: '360',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  lumpSum: [],
  extraMonthlyPct: '0',
  extraMonthlyPctStart: '',
  extraMonthlyPctUntil: '',
  fixedPaymentStart: '',
  fgtsAnnual: '0',
  fgtsStartMonth: '12',
  fgtsUntilMonth: '',
  recurringExtra: null,
  fixedPayment: '',
  fixedPaymentUntil: '',
  paySacParcela: false,
  reduceMode: 'term',
  portability: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReduceMode(value: unknown): value is ReduceMode {
  return value === 'payment' || value === 'term';
}

function isAmortSystem(value: unknown): value is AmortSystem {
  return value === 'PRICE' || value === 'SAC';
}

function cloneForm(form: FormState): FormState {
  return {
    ...form,
    lumpSum: form.lumpSum.map((payment) => ({ ...payment })),
    recurringExtra: form.recurringExtra ? { ...form.recurringExtra } : null,
    portability: form.portability ? { ...form.portability } : null,
  };
}

function storedString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function parseStoredLumpSum(value: unknown, fallback: ExtraPayment[]): ExtraPayment[] {
  if (!Array.isArray(value)) return fallback.map((payment) => ({ ...payment }));
  const payments: ExtraPayment[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !Number.isInteger(item.month) ||
      (item.month as number) < 1 ||
      typeof item.amount !== 'number' ||
      !Number.isFinite(item.amount) ||
      item.amount < 0 ||
      (item.reduceMode !== undefined && !isReduceMode(item.reduceMode))
    ) {
      return fallback.map((payment) => ({ ...payment }));
    }
    payments.push({
      month: item.month as number,
      amount: item.amount,
      ...(item.reduceMode ? { reduceMode: item.reduceMode } : {}),
    });
  }
  return payments;
}

function parseStoredRecurringExtra(
  value: unknown,
  fallback: RecurringExtraForm | null
): RecurringExtraForm | null {
  if (value === null) return null;
  if (!isRecord(value)) return fallback ? { ...fallback } : null;
  if (
    typeof value.amount !== 'string' ||
    typeof value.every !== 'string' ||
    typeof value.startMonth !== 'string' ||
    (value.untilMonth !== undefined && typeof value.untilMonth !== 'string')
  ) {
    return fallback ? { ...fallback } : null;
  }
  return {
    amount: value.amount,
    every: value.every,
    startMonth: value.startMonth,
    untilMonth: value.untilMonth ?? '',
  };
}

function parseStoredPortability(
  value: unknown,
  fallback: PortabilityForm | null
): PortabilityForm | null {
  if (value === null) return null;
  if (!isRecord(value)) return fallback ? { ...fallback } : null;
  const annualRateKind = value.annualRateKind === undefined
    ? 'effective-annual'
    : isRateKind(value.annualRateKind)
      ? value.annualRateKind
      : null;
  if (
    typeof value.annualRate !== 'string' ||
    annualRateKind === null ||
    typeof value.bank !== 'string' ||
    value.bank.trim() === ''
  ) {
    return fallback ? { ...fallback } : null;
  }
  return {
    annualRate: value.annualRate,
    annualRateKind,
    bank: value.bank,
  };
}

function parseMoneyStrict(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return cleaned === '' ? NaN : Number(cleaned);
}

function isValidAnnualRate(value: string, kind: RateKind): boolean {
  const percent = parseDecimal(value);
  if (!Number.isFinite(percent) || percent < 0) return false;
  try {
    const effectiveAnnual = normalizeRate(percent, kind).effectiveAnnual;
    return Number.isFinite(effectiveAnnual) && effectiveAnnual >= 0 && effectiveAnnual <= 1;
  } catch {
    return false;
  }
}

function isValidMonths(value: string): boolean {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= 600;
}

function parseOptionalMonth(value: string, maxMonth = Infinity): number | null | undefined {
  if (value === '') return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maxMonth ? parsed : null;
}

function hasValidWindow(startValue: string, untilValue: string, months: number): boolean {
  const start = parseOptionalMonth(startValue, months);
  const until = parseOptionalMonth(untilValue);
  if (start === null || until === null) return false;
  return start === undefined || until === undefined || start <= until;
}

function sanitizeStoredForm(form: FormState, fallback: FormState): FormState {
  const fallbackPrincipal = (() => {
    const principal = parseMoneyStrict(fallback.principal);
    return Number.isFinite(principal) && principal > 0 && principal <= 1_000_000_000_000
      ? fallback.principal
      : DEFAULT_FORM.principal;
  })();
  const fallbackMonths = isValidMonths(fallback.months) ? fallback.months : DEFAULT_FORM.months;
  const fallbackRate = isValidAnnualRate(fallback.annualRate, fallback.annualRateKind)
    ? { annualRate: fallback.annualRate, annualRateKind: fallback.annualRateKind }
    : { annualRate: DEFAULT_FORM.annualRate, annualRateKind: DEFAULT_FORM.annualRateKind };
  const fallbackTr = (() => {
    const tr = parseDecimal(fallback.trMonthly);
    return Number.isFinite(tr) && tr >= 0 && tr <= 10 ? fallback.trMonthly : DEFAULT_FORM.trMonthly;
  })();
  const fallbackInsurance = (() => {
    const insurance = parseMoneyStrict(fallback.insuranceMonthly);
    return Number.isFinite(insurance) && insurance >= 0
      ? fallback.insuranceMonthly
      : DEFAULT_FORM.insuranceMonthly;
  })();
  const fallbackBank = fallback.bank.length <= 60 ? fallback.bank : DEFAULT_FORM.bank;

  const principal = parseMoneyStrict(form.principal);
  const tr = parseDecimal(form.trMonthly);
  const insurance = parseMoneyStrict(form.insuranceMonthly);
  const rate = isValidAnnualRate(form.annualRate, form.annualRateKind)
    ? { annualRate: form.annualRate, annualRateKind: form.annualRateKind }
    : fallbackRate;
  const sanitized: FormState = {
    ...form,
    principal: Number.isFinite(principal) && principal > 0 && principal <= 1_000_000_000_000
      ? form.principal
      : fallbackPrincipal,
    ...rate,
    months: isValidMonths(form.months) ? form.months : fallbackMonths,
    trMonthly: Number.isFinite(tr) && tr >= 0 && tr <= 10 ? form.trMonthly : fallbackTr,
    insuranceMonthly: Number.isFinite(insurance) && insurance >= 0
      ? form.insuranceMonthly
      : fallbackInsurance,
    bank: form.bank.length <= 60 ? form.bank : fallbackBank,
  };
  const months = Number(sanitized.months);

  if (!sanitized.lumpSum.every((payment) => payment.month <= months)) {
    sanitized.lumpSum = [];
  }

  const extraMonthlyPct = parseDecimal(sanitized.extraMonthlyPct);
  if (
    !Number.isFinite(extraMonthlyPct) ||
    extraMonthlyPct < 0 ||
    extraMonthlyPct > 100 ||
    (extraMonthlyPct > 0 && !hasValidWindow(
      sanitized.extraMonthlyPctStart,
      sanitized.extraMonthlyPctUntil,
      months
    ))
  ) {
    sanitized.extraMonthlyPct = DEFAULT_FORM.extraMonthlyPct;
    sanitized.extraMonthlyPctStart = DEFAULT_FORM.extraMonthlyPctStart;
    sanitized.extraMonthlyPctUntil = DEFAULT_FORM.extraMonthlyPctUntil;
  }

  const fgtsAnnual = parseMoneyStrict(sanitized.fgtsAnnual);
  if (
    !Number.isFinite(fgtsAnnual) ||
    fgtsAnnual < 0 ||
    (fgtsAnnual > 0 && !hasValidWindow(
      sanitized.fgtsStartMonth,
      sanitized.fgtsUntilMonth,
      months
    ))
  ) {
    sanitized.fgtsAnnual = DEFAULT_FORM.fgtsAnnual;
    sanitized.fgtsStartMonth = DEFAULT_FORM.fgtsStartMonth;
    sanitized.fgtsUntilMonth = DEFAULT_FORM.fgtsUntilMonth;
  }

  if (sanitized.recurringExtra) {
    const amount = parseMoneyStrict(sanitized.recurringExtra.amount);
    const every = Number(sanitized.recurringExtra.every);
    const start = parseOptionalMonth(sanitized.recurringExtra.startMonth, months);
    const until = parseOptionalMonth(sanitized.recurringExtra.untilMonth);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isInteger(every) ||
      every < 1 ||
      start === null ||
      start === undefined ||
      until === null ||
      (until !== undefined && start > until)
    ) {
      sanitized.recurringExtra = null;
    }
  }

  const fixedPayment = sanitized.fixedPayment === '' ? 0 : parseMoneyStrict(sanitized.fixedPayment);
  if (
    !Number.isFinite(fixedPayment) ||
    fixedPayment < 0 ||
    (fixedPayment > 0 && !hasValidWindow(
      sanitized.fixedPaymentStart,
      sanitized.fixedPaymentUntil,
      months
    ))
  ) {
    sanitized.fixedPayment = DEFAULT_FORM.fixedPayment;
    sanitized.fixedPaymentStart = DEFAULT_FORM.fixedPaymentStart;
    sanitized.fixedPaymentUntil = DEFAULT_FORM.fixedPaymentUntil;
  }

  if (sanitized.portability) {
    const portabilityRate = parseDecimal(sanitized.portability.annualRate);
    let effectiveAnnual = NaN;
    try {
      effectiveAnnual = normalizeRate(
        portabilityRate,
        sanitized.portability.annualRateKind
      ).effectiveAnnual;
    } catch {
      // Invalid portability is dropped below.
    }
    if (
      !Number.isFinite(portabilityRate) ||
      portabilityRate < 0 ||
      !Number.isFinite(effectiveAnnual) ||
      effectiveAnnual > 1 ||
      sanitized.portability.bank.length > 60
    ) {
      sanitized.portability = null;
    }
  }

  return sanitized;
}

export function formToInput(f: FormState): LoanInput {
  const annualRate = parseDecimal(f.annualRate);
  const trMonthly = parseDecimal(f.trMonthly);
  const months = Number(f.months);
  return {
    system: f.system,
    principal: parseBRLToNumber(f.principal),
    annualRate: Number.isFinite(annualRate) && annualRate > 0
      ? normalizeRate(annualRate, f.annualRateKind).effectiveAnnual
      : 0,
    months: Number.isFinite(months) && months > 0 ? months : 0,
    trMonthly: Number.isFinite(trMonthly) && trMonthly >= 0 ? trMonthly / 100 : 0,
    insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank: f.bank,
  };
}

export function parseStoredForm(raw: string | null, fallback: FormState = DEFAULT_FORM): FormState {
  const base = sanitizeStoredForm(cloneForm(fallback), DEFAULT_FORM);
  if (!raw) return base;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return base;
    return sanitizeStoredForm({
      system: isAmortSystem(stored.system) ? stored.system : base.system,
      principal: storedString(stored.principal, base.principal),
      annualRate: storedString(stored.annualRate, base.annualRate),
      annualRateKind: isRateKind(stored.annualRateKind) ? stored.annualRateKind : base.annualRateKind,
      months: storedString(stored.months, base.months),
      trMonthly: storedString(stored.trMonthly, base.trMonthly),
      insuranceMonthly: storedString(stored.insuranceMonthly, base.insuranceMonthly),
      bank: storedString(stored.bank, base.bank),
      lumpSum: parseStoredLumpSum(stored.lumpSum, base.lumpSum),
      extraMonthlyPct: storedString(stored.extraMonthlyPct, base.extraMonthlyPct),
      extraMonthlyPctStart: storedString(stored.extraMonthlyPctStart, base.extraMonthlyPctStart),
      extraMonthlyPctUntil: storedString(stored.extraMonthlyPctUntil, base.extraMonthlyPctUntil),
      fixedPaymentStart: storedString(stored.fixedPaymentStart, base.fixedPaymentStart),
      fgtsAnnual: storedString(stored.fgtsAnnual, base.fgtsAnnual),
      fgtsStartMonth: storedString(stored.fgtsStartMonth, base.fgtsStartMonth),
      fgtsUntilMonth: storedString(stored.fgtsUntilMonth, base.fgtsUntilMonth),
      recurringExtra: parseStoredRecurringExtra(stored.recurringExtra, base.recurringExtra),
      fixedPayment: storedString(stored.fixedPayment, base.fixedPayment),
      fixedPaymentUntil: storedString(stored.fixedPaymentUntil, base.fixedPaymentUntil),
      paySacParcela: typeof stored.paySacParcela === 'boolean'
        ? stored.paySacParcela
        : base.paySacParcela,
      reduceMode: isReduceMode(stored.reduceMode) ? stored.reduceMode : base.reduceMode,
      portability: parseStoredPortability(stored.portability, base.portability),
    }, base);
  } catch {
    return base;
  }
}

export function parseSimulationJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
  } catch {
    return null;
  }
}

export function formToStrategies(f: FormState): Strategies {
  const extraMonthlyPct = parseDecimal(f.extraMonthlyPct);
  const fgtsAnnual = parseBRLToNumber(f.fgtsAnnual);
  const portAnnualRate = typeof f.portability?.annualRate === 'string'
    ? parseDecimal(f.portability.annualRate)
    : 0;
  const recurring: RecurringExtra | null = f.recurringExtra
    ? {
        amount: parseBRLToNumber(f.recurringExtra.amount),
        every: Number(f.recurringExtra.every),
        startMonth: Number(f.recurringExtra.startMonth),
        ...(parseIntSafe(f.recurringExtra.untilMonth) >= 1 ? { untilMonth: parseIntSafe(f.recurringExtra.untilMonth) } : {}),
      }
    : null;
  const fgtsUntil = parseIntSafe(f.fgtsUntilMonth);
  const fgtsStart = parseIntSafe(f.fgtsStartMonth);
  const pctStart = parseIntSafe(f.extraMonthlyPctStart);
  const pctUntil = parseIntSafe(f.extraMonthlyPctUntil);
  return {
    extraLumpSum: f.lumpSum,
    ...(Number.isFinite(extraMonthlyPct) && extraMonthlyPct > 0
      ? {
          extraMonthlyPct: extraMonthlyPct / 100,
          ...(pctStart >= 1 ? { extraMonthlyPctStartMonth: pctStart } : {}),
          ...(pctUntil >= 1 ? { extraMonthlyPctUntilMonth: pctUntil } : {}),
        }
      : {}),
    ...(fgtsAnnual > 0
      ? {
          fgtsAnnual: {
            amount: fgtsAnnual,
            ...(fgtsStart >= 1 ? { startMonth: fgtsStart } : {}),
            ...(fgtsUntil >= 1 ? { untilMonth: fgtsUntil } : {}),
          },
        }
      : {}),
    ...(recurring && Number.isFinite(recurring.amount) && recurring.amount > 0 && Number.isInteger(recurring.every) && recurring.every >= 1 && Number.isInteger(recurring.startMonth) && recurring.startMonth >= 1
      ? { recurringExtra: recurring }
      : {}),
    ...(f.paySacParcela ? { paySacParcela: true } : {}),
    ...(() => {
      const amount = parseBRLToNumber(f.fixedPayment);
      if (!(amount > 0)) return {};
      const until = parseIntSafe(f.fixedPaymentUntil);
      const start = parseIntSafe(f.fixedPaymentStart);
      return {
        fixedPayment: {
          amount,
          ...(start > 0 ? { startMonth: start } : {}),
          ...(until > 0 ? { untilMonth: until } : {}),
        },
      };
    })(),
    reduceMode: f.reduceMode,
    ...(f.portability && Number.isFinite(portAnnualRate) && portAnnualRate >= 0
      ? {
          portability: {
            annualRate: normalizeRate(portAnnualRate, f.portability!.annualRateKind ?? 'effective-annual').effectiveAnnual,
            bank: f.portability.bank,
            insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
          },
        }
      : {}),
  };
}
