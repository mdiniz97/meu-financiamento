import type { AmortSystem, ExtraPayment, LoanInput, Strategies } from './finance/types';
import { parseBRLToNumber } from './utils';

export type ReduceMode = 'payment' | 'term';

export interface PortabilityForm {
  annualRate: string;
  bank: string;
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
  reduceMode: 'term',
  portability: null,
};

export function formToInput(f: FormState): LoanInput {
  return {
    system: f.system,
    principal: parseBRLToNumber(f.principal),
    annualRate: Number(f.annualRate) / 100,
    months: Number(f.months),
    trMonthly: Number(f.trMonthly) / 100,
    insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank: f.bank,
  };
}

export function formToStrategies(f: FormState): Strategies {
  const extraMonthlyPct = Number(f.extraMonthlyPct) / 100;
  const fgtsAnnual = parseBRLToNumber(f.fgtsAnnual);
  return {
    extraLumpSum: f.lumpSum,
    ...(extraMonthlyPct > 0 ? { extraMonthlyPct } : {}),
    ...(fgtsAnnual > 0 ? { fgtsAnnual } : {}),
    reduceMode: f.reduceMode,
    ...(f.portability
      ? {
          portability: {
            annualRate: Number(f.portability.annualRate) / 100,
            bank: f.portability.bank,
            insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
          },
        }
      : {}),
  };
}
