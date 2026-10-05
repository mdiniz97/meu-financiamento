import { calculatePeakPayment } from './financing-capacity';
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
const MAX_PRINCIPAL = 1_000_000_000_000;
const RATE_ITERATIONS = 60;
const MONTH_ITERATIONS = 40;
const PRINCIPAL_ITERATIONS = 60;
const CENT = 0.01;

function paymentsAt(input: NegotiationInput, rate: number, months: number, principal: number) {
  return calculatePeakPayment(
    {
      maxPayment: Number.POSITIVE_INFINITY,
      annualRate: rate,
      trMonthly: input.trMonthly,
      insuranceMonthly: input.insuranceMonthly,
      bank: input.bank,
      months,
    },
    principal,
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
 * Mesa de negociação. Critério: a **1ª parcela** (o que a pessoa paga hoje)
 * precisa caber no teto. O pico é devolvido como aviso (com TR a parcela sobe
 * ao longo do tempo), mas não reprova a proposta. Os limites aceitáveis (taxa
 * máxima, prazo mínimo, principal máximo) usam o mesmo critério da 1ª parcela.
 */
export function evaluateNegotiation(input: NegotiationInput): NegotiationResult {
  validate(input);
  const teto = input.maxPayment;

  const current = paymentsAt(input, input.annualRate, input.months, input.principal);
  const fits = current.initialPayment <= teto + CENT;

  // maior taxa em que a 1ª parcela ainda cabe (parcela cresce com a taxa)
  let maxAnnualRate: number | null;
  if (paymentsAt(input, 0, input.months, input.principal).initialPayment > teto) {
    maxAnnualRate = null;
  } else if (paymentsAt(input, MAX_RATE, input.months, input.principal).initialPayment <= teto) {
    maxAnnualRate = MAX_RATE;
  } else {
    let lo = 0;
    let hi = MAX_RATE;
    for (let i = 0; i < RATE_ITERATIONS && hi - lo > 1e-6; i++) {
      const mid = (lo + hi) / 2;
      if (paymentsAt(input, mid, input.months, input.principal).initialPayment <= teto) lo = mid;
      else hi = mid;
    }
    maxAnnualRate = Math.floor(lo * 1e6) / 1e6;
  }

  // menor prazo em que a 1ª parcela cabe (prazo maior = parcela menor)
  let minMonths: number;
  if (paymentsAt(input, input.annualRate, MAX_MONTHS, input.principal).initialPayment > teto) {
    minMonths = MAX_MONTHS;
  } else {
    let lo = 1;
    let hi = MAX_MONTHS;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (paymentsAt(input, input.annualRate, mid, input.principal).initialPayment <= teto) hi = mid;
      else lo = mid + 1;
    }
    minMonths = lo;
  }

  // maior principal com a 1ª parcela <= teto (cresce com o principal)
  let maxPrincipal: number;
  if (paymentsAt(input, input.annualRate, input.months, MAX_PRINCIPAL).initialPayment <= teto) {
    maxPrincipal = MAX_PRINCIPAL;
  } else {
    let lo = 0;
    let hi = 1;
    while (hi < MAX_PRINCIPAL && paymentsAt(input, input.annualRate, input.months, hi).initialPayment <= teto) {
      hi = Math.min(MAX_PRINCIPAL, Math.max(hi + 1, hi * 2));
    }
    for (let i = 0; i < PRINCIPAL_ITERATIONS && hi - lo > CENT; i++) {
      const mid = (lo + hi) / 2;
      if (paymentsAt(input, input.annualRate, input.months, mid).initialPayment <= teto) lo = mid;
      else hi = mid;
    }
    maxPrincipal = Math.floor(lo * 100) / 100;
  }

  const currentDownPayment = Math.max(0, input.propertyValue - input.principal);
  const minDownPayment = Math.max(0, input.propertyValue - maxPrincipal);
  const maxPropertyValue = maxPrincipal + currentDownPayment;

  return {
    fits,
    initialPayment: current.initialPayment,
    peakPayment: current.peakPayment,
    peakPaymentMonth: current.peakPaymentMonth,
    slackMonthly: fits ? Math.max(0, teto - current.initialPayment) : 0,
    maxAnnualRate,
    minMonths,
    maxPrincipal,
    minDownPayment,
    maxPropertyValue,
  };
}
