import type { AmortSystem, ExtraPayment, LoanInput, RecurringExtra, Strategies } from './finance/types';
import { parseBRLToNumber, parseDecimal } from './utils';

const parseIntSafe = (s: string | undefined) => {
  if (s == null) return 0;
  const d = s.replace(/[^\d]/g, '');
  return d === '' ? 0 : Number(d);
};

export type ReduceMode = 'payment' | 'term';

export interface PortabilityForm {
  annualRate: string;
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
  months: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  lumpSum: ExtraPayment[];
  extraMonthlyPct: string;
  extraMonthlyPctStart: string;
  extraMonthlyPctUntil: string;
  extraMonthlyPctGrowth: string;
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
  months: '360',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  lumpSum: [],
  extraMonthlyPct: '0',
  extraMonthlyPctStart: '',
  extraMonthlyPctUntil: '',
  extraMonthlyPctGrowth: '',
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

export function formToInput(f: FormState): LoanInput {
  const annualRate = parseDecimal(f.annualRate);
  const trMonthly = parseDecimal(f.trMonthly);
  const months = Number(f.months);
  return {
    system: f.system,
    principal: parseBRLToNumber(f.principal),
    annualRate: Number.isFinite(annualRate) && annualRate > 0 ? annualRate / 100 : 0,
    months: Number.isFinite(months) && months > 0 ? months : 0,
    trMonthly: Number.isFinite(trMonthly) && trMonthly >= 0 ? trMonthly / 100 : 0,
    insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank: f.bank,
  };
}

export function parseStoredForm(raw: string | null, fallback: FormState = DEFAULT_FORM): FormState {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as FormState) };
  } catch {
    return fallback;
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
  const portAnnualRate = f.portability ? parseDecimal(f.portability.annualRate) : 0;
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
  const pctGrowth = parseDecimal(f.extraMonthlyPctGrowth);
  return {
    extraLumpSum: f.lumpSum,
    ...(Number.isFinite(extraMonthlyPct) && extraMonthlyPct > 0
      ? {
          extraMonthlyPct: extraMonthlyPct / 100,
          ...(pctStart >= 1 ? { extraMonthlyPctStartMonth: pctStart } : {}),
          ...(pctUntil >= 1 ? { extraMonthlyPctUntilMonth: pctUntil } : {}),
          ...(Number.isFinite(pctGrowth) && pctGrowth > 0 ? { extraMonthlyPctGrowthYearly: pctGrowth / 100 } : {}),
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
    ...(f.portability && Number.isFinite(portAnnualRate) && portAnnualRate > 0
      ? {
          portability: {
            annualRate: portAnnualRate / 100,
            bank: f.portability.bank,
            insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
          },
        }
      : {}),
  };
}
