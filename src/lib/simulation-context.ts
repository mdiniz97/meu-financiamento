import type { AmortSystem, ExtraPayment, LoanInput, RecurringExtra, Strategies } from './finance/types';
import { parseBRLToNumber, parseDecimal } from './utils';

export type ReduceMode = 'payment' | 'term';

export interface PortabilityForm {
  annualRate: string;
  bank: string;
}

export interface RecurringExtraForm {
  amount: string;
  every: string;
  startMonth: string;
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
  fgtsAnnual: string;
  recurringExtra: RecurringExtraForm | null;
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
  fgtsAnnual: '0',
  recurringExtra: null,
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
      }
    : null;
  return {
    extraLumpSum: f.lumpSum,
    ...(Number.isFinite(extraMonthlyPct) && extraMonthlyPct > 0
      ? { extraMonthlyPct: extraMonthlyPct / 100 }
      : {}),
    ...(fgtsAnnual > 0 ? { fgtsAnnual } : {}),
    ...(recurring && Number.isFinite(recurring.amount) && recurring.amount > 0 && Number.isInteger(recurring.every) && recurring.every >= 1 && Number.isInteger(recurring.startMonth) && recurring.startMonth >= 1
      ? { recurringExtra: recurring }
      : {}),
    ...(f.paySacParcela ? { paySacParcela: true } : {}),
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
