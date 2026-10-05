import { calculateFinancingCapacity, calculatePeakPayment } from './financing-capacity';
import type { AmortSystem } from './types';

export interface NegotiationInput {
  system: AmortSystem;
  principal: number;
  propertyValue: number;
  annualRate: number; // taxa efetiva anual (0.10 = 10%)
  months: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  maxPayment: number; // teto de parcela
}

export interface NegotiationResult {
  fits: boolean;
  initialPayment: number;
  peakPayment: number;
  peakPaymentMonth: number;
  slackMonthly: number;
  maxAnnualRate: number | null;
  minMonths: number;
  maxPrincipal: number;
  minDownPayment: number;
  maxPropertyValue: number;
}

const MAX_RATE = 1; // 100% a.a.
const MAX_MONTHS = 600;
const RATE_ITERATIONS = 60;
const MONTH_ITERATIONS = 40;
const CENT = 0.01;

function peakAt(input: NegotiationInput, rate: number, months: number) {
  return calculatePeakPayment(
    {
      maxPayment: Number.POSITIVE_INFINITY,
      annualRate: rate,
      trMonthly: input.trMonthly,
      insuranceMonthly: input.insuranceMonthly,
      bank: input.bank,
      months,
    },
    input.principal,
    input.system
  );
}

function validate(input: NegotiationInput): void {
  const finite = (n: number) => Number.isFinite(n);
  const ok =
    (input.system === 'PRICE' || input.system === 'SAC') &&
    finite(input.principal) && input.principal >= 0 &&
    finite(input.propertyValue) && input.propertyValue >= 0 &&
    finite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= MAX_RATE &&
    Number.isInteger(input.months) && input.months >= 1 && input.months <= MAX_MONTHS &&
    finite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1 &&
    finite(input.insuranceMonthly) && input.insuranceMonthly >= 0 &&
    typeof input.bank === 'string' && input.bank.trim().length > 0 && input.bank.length <= 60 &&
    finite(input.maxPayment) && input.maxPayment > 0;
  if (!ok) throw new Error('Input inválido para negociação.');
}

/**
 * Mesa de negociação: dado o contrato e um teto de parcela, diz se cabe e os
 * limites de negociação (taxa máxima, entrada mínima, prazo mínimo viável). O
 * critério é o PICO de parcela (não só a 1ª), igual ao restante do app.
 */
export function evaluateNegotiation(input: NegotiationInput): NegotiationResult {
  validate(input);
  const teto = input.maxPayment;

  const current = peakAt(input, input.annualRate, input.months);
  const fits = current.peakPayment <= teto + CENT;

  // maior taxa que ainda cabe (parcela cresce com a taxa)
  let maxAnnualRate: number | null;
  if (peakAt(input, 0, input.months).peakPayment > teto) {
    maxAnnualRate = null;
  } else if (peakAt(input, MAX_RATE, input.months).peakPayment <= teto) {
    maxAnnualRate = MAX_RATE;
  } else {
    let lo = 0;
    let hi = MAX_RATE;
    for (let i = 0; i < RATE_ITERATIONS && hi - lo > 1e-6; i++) {
      const mid = (lo + hi) / 2;
      if (peakAt(input, mid, input.months).peakPayment <= teto) lo = mid;
      else hi = mid;
    }
    maxAnnualRate = Math.floor(lo * 1e6) / 1e6;
  }

  // menor prazo que ainda cabe (prazo maior = parcela menor)
  let minMonths: number;
  if (peakAt(input, input.annualRate, MAX_MONTHS).peakPayment > teto) {
    minMonths = MAX_MONTHS;
  } else {
    let lo = 1;
    let hi = MAX_MONTHS;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (peakAt(input, input.annualRate, mid).peakPayment <= teto) hi = mid;
      else lo = mid + 1;
    }
    minMonths = lo;
  }

  const capacity = calculateFinancingCapacity({
    maxPayment: teto,
    annualRate: input.annualRate,
    trMonthly: input.trMonthly,
    insuranceMonthly: input.insuranceMonthly,
    bank: input.bank,
    months: input.months,
  });
  const maxPrincipal = Math.max(0, capacity[input.system].safeLimit);
  const currentDownPayment = Math.max(0, input.propertyValue - input.principal);
  const minDownPayment = Math.max(0, input.propertyValue - maxPrincipal);
  const maxPropertyValue = maxPrincipal + currentDownPayment;

  return {
    fits,
    initialPayment: current.initialPayment,
    peakPayment: current.peakPayment,
    peakPaymentMonth: current.peakPaymentMonth,
    slackMonthly: fits ? Math.max(0, teto - current.peakPayment) : 0,
    maxAnnualRate,
    minMonths,
    maxPrincipal,
    minDownPayment,
    maxPropertyValue,
  };
}
