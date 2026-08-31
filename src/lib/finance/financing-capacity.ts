import { simulate } from './engine';
import { type MaxFinancingInput } from './smart';
import type { AmortSystem, LoanInput } from './types';

export interface FinancingCapacitySystemResult {
  initialLimit: number;
  safeLimit: number;
  initialPayment: number;
  peakPayment: number;
  peakPaymentMonth: number;
}

export type FinancingCapacityResult = Record<AmortSystem, FinancingCapacitySystemResult>;

const MAX_PRINCIPAL = 1_000_000_000_000;

export function calculatePeakPayment(input: MaxFinancingInput, principal: number, system: AmortSystem) {
  if (principal <= 0) {
    return { initialPayment: 0, peakPayment: 0, peakPaymentMonth: 0 };
  }
  const loanInput: LoanInput = {
    system,
    principal,
    annualRate: input.annualRate,
    months: input.months,
    trMonthly: input.trMonthly,
    insuranceMonthly: input.insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank: input.bank,
  };
  let installments;
  try {
    installments = simulate(loanInput).installments;
  } catch {
    return { initialPayment: Infinity, peakPayment: Infinity, peakPaymentMonth: 0 };
  }
  if (
    installments.length === 0 ||
    installments.some((item) => !Number.isFinite(item.parcela) || item.parcela < 0) ||
    !Number.isFinite(installments.at(-1)?.saldo) ||
    (installments.at(-1)?.saldo ?? Infinity) > 0.005
  ) {
    return { initialPayment: Infinity, peakPayment: Infinity, peakPaymentMonth: 0 };
  }
  const peak = installments.reduce(
    (current, item) => item.parcela > current.peakPayment
      ? { peakPayment: item.parcela, peakPaymentMonth: item.month }
      : current,
    { peakPayment: 0, peakPaymentMonth: 0 }
  );
  return { initialPayment: installments[0]?.parcela ?? 0, ...peak };
}

export function calculateFinancingCapacity(input: MaxFinancingInput): FinancingCapacityResult {
  validateFinancingCapacityInput(input);
  const calculate = (system: AmortSystem): FinancingCapacitySystemResult => {
    const initialLimit = Math.min(MAX_PRINCIPAL, Math.floor(directInitialLimit(input, system) * 100) / 100);
    if (initialLimit <= 0 || input.maxPayment <= input.insuranceMonthly) {
      return { initialLimit, safeLimit: 0, ...calculatePeakPayment(input, 0, system) };
    }

    let lo = 0;
    let hi = initialLimit;
    const capPayments = calculatePeakPayment(input, MAX_PRINCIPAL, system);
    if (capPayments.peakPayment <= input.maxPayment) {
      return { initialLimit, safeLimit: MAX_PRINCIPAL, ...capPayments };
    }
    while (hi < MAX_PRINCIPAL && calculatePeakPayment(input, hi, system).peakPayment <= input.maxPayment) {
      hi = Math.min(MAX_PRINCIPAL, Math.max(hi + 0.01, hi * 2));
    }
    for (let iteration = 0; iteration < 60 && hi - lo > 0.001; iteration++) {
      const middle = (lo + hi) / 2;
      if (calculatePeakPayment(input, middle, system).peakPayment <= input.maxPayment) lo = middle;
      else hi = middle;
    }

    let safeLimit = Math.floor(lo * 100) / 100;
    let payments = calculatePeakPayment(input, safeLimit, system);
    let adjustments = 0;
    while (payments.peakPayment > input.maxPayment && adjustments < 100) {
      safeLimit = Math.max(0, safeLimit - 0.01);
      payments = calculatePeakPayment(input, safeLimit, system);
      adjustments++;
    }
    if (payments.peakPayment > input.maxPayment) {
      throw new Error('Não foi possível obter limite seguro em centavos.');
    }
    let nextPayments = calculatePeakPayment(input, safeLimit + 0.01, system);
    while (nextPayments.peakPayment <= input.maxPayment && adjustments < 100) {
      safeLimit = Math.round((safeLimit + 0.01) * 100) / 100;
      payments = nextPayments;
      nextPayments = calculatePeakPayment(input, safeLimit + 0.01, system);
      adjustments++;
    }
    if (nextPayments.peakPayment <= input.maxPayment) {
      throw new Error('Não foi possível obter limite máximo em centavos.');
    }
    return { initialLimit, safeLimit, ...payments };
  };

  return { PRICE: calculate('PRICE'), SAC: calculate('SAC') };
}

function directInitialLimit(input: MaxFinancingInput, system: AmortSystem): number {
  const available = Math.max(0, input.maxPayment - input.insuranceMonthly);
  if (available === 0) return 0;
  const monthlyRate = Math.pow(1 + input.annualRate, 1 / 12) - 1;
  if (system === 'PRICE') {
    return monthlyRate === 0
      ? available * input.months
      : available * (1 - Math.pow(1 + monthlyRate, -input.months)) / monthlyRate;
  }
  return available / (1 / input.months + monthlyRate);
}

function validateFinancingCapacityInput(input: MaxFinancingInput): void {
  const valid =
    Number.isFinite(input.maxPayment) && input.maxPayment > 0 &&
    Number.isFinite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= 1 &&
    Number.isFinite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1 &&
    Number.isFinite(input.insuranceMonthly) && input.insuranceMonthly >= 0 &&
    Number.isInteger(input.months) && input.months >= 1 && input.months <= 600 &&
    typeof input.bank === 'string' && input.bank.trim().length > 0 && input.bank.length <= 60;
  if (!valid) throw new Error('Input inválido para cálculo da capacidade.');
}
