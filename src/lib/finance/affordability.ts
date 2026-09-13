import { calculateFinancingCapacity, calculatePeakPayment } from './financing-capacity';
import type { AmortSystem } from './types';

export interface AffordabilityInput {
  monthlyIncome: number;
  paymentCap: number;
  availableCash: number;
  initialCosts: number;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  months: number;
}

export interface AffordabilitySystemResult {
  maxFinancing: number;
  maxPropertyValue: number;
  firstPayment: number;
  incomeCommitmentPct: number;
}

export interface AffordabilityScenario {
  key: 'conservative' | 'recommended' | 'maximum';
  label: string;
  commitmentPct: number;
  monthlyBudget: number;
  systems: Record<AmortSystem, AffordabilitySystemResult>;
}

export interface AffordabilityResult {
  availableDownPayment: number;
  scenarios: AffordabilityScenario[];
}

export interface PaymentAffordabilityInput {
  maxPayment: number;
  availableCash: number;
  initialCosts: number;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  months: number;
}

export interface PaymentAffordabilityAlternative {
  principal: number;
  propertyValue: number;
  initialPayment: number;
  peakPayment: number;
  peakPaymentMonth: number;
}

export interface PaymentAffordabilityResult {
  availableDownPayment: number;
  initialCosts: number;
  systems: Record<AmortSystem, {
    initial: PaymentAffordabilityAlternative | null;
    safe: PaymentAffordabilityAlternative | null;
  }>;
}

const SCENARIOS = [
  { key: 'conservative', label: 'Conservador', commitmentPct: 0.2 },
  { key: 'recommended', label: 'Recomendado', commitmentPct: 0.25 },
  { key: 'maximum', label: 'Máximo', commitmentPct: 0.3 },
] as const;

/**
 * Dimensiona o valor financiável de cada sistema pelo maior principal cujo
 * pico de parcela cabe no orçamento do cenário, e não apenas pela parcela 1.
 * Isso alinha o affordance por renda ao Amortizador Inteligente e ao modo por
 * parcela, que também exigem que todas as parcelas caibam no teto.
 */
export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  if (!(input.monthlyIncome > 0)) throw new Error('Informe uma renda mensal válida.');
  if (!(input.paymentCap >= 0)) throw new Error('Informe uma parcela máxima válida.');
  if (!(input.availableCash >= 0)) throw new Error('Informe uma entrada disponível válida.');
  if (!(input.initialCosts >= 0)) throw new Error('Custos iniciais não podem ser negativos.');
  if (!(input.annualRate >= 0 && input.annualRate <= 1)) throw new Error('Informe uma taxa anual válida.');
  if (!(input.trMonthly >= 0 && input.trMonthly <= 1)) throw new Error('Informe uma TR mensal válida.');
  if (!(input.insuranceMonthly >= 0)) throw new Error('Informe um seguro mensal válido.');
  if (!(input.months >= 1 && input.months <= 600)) throw new Error('Prazo deve estar entre 1 e 600 meses.');

  const availableDownPayment = Math.max(0, input.availableCash - input.initialCosts);

  const scenarios = SCENARIOS.map(({ key, label, commitmentPct }) => {
    const incomeBudget = input.monthlyIncome * commitmentPct;
    const monthlyBudget = input.paymentCap > 0
      ? Math.min(incomeBudget, input.paymentCap)
      : incomeBudget;
    const capacity = calculateFinancingCapacity({
      maxPayment: monthlyBudget,
      annualRate: input.annualRate,
      trMonthly: input.trMonthly,
      insuranceMonthly: input.insuranceMonthly,
      bank: input.bank,
      months: input.months,
    });

    const systems = Object.fromEntries(
      (['PRICE', 'SAC'] as const).map((system) => {
        const max = capacity[system].safeLimit;
        const firstPayment = capacity[system].initialPayment;
        return [system, {
          maxFinancing: max,
          maxPropertyValue: max + availableDownPayment,
          firstPayment,
          incomeCommitmentPct: firstPayment / input.monthlyIncome,
        }];
      })
    ) as Record<AmortSystem, AffordabilitySystemResult>;

    return { key, label, commitmentPct, monthlyBudget, systems };
  });

  return { availableDownPayment, scenarios };
}

export function calculatePaymentAffordability(input: PaymentAffordabilityInput): PaymentAffordabilityResult {
  if (!(input.maxPayment > 0)) throw new Error('Informe uma parcela máxima válida.');
  if (!(input.availableCash >= 0)) throw new Error('Informe uma entrada disponível válida.');
  if (!(input.initialCosts >= 0)) throw new Error('Custos iniciais não podem ser negativos.');

  const availableDownPayment = Math.max(0, input.availableCash - input.initialCosts);
  const capacityInput = {
    maxPayment: input.maxPayment,
    annualRate: input.annualRate,
    trMonthly: input.trMonthly,
    insuranceMonthly: input.insuranceMonthly,
    bank: input.bank,
    months: input.months,
  };
  const capacity = calculateFinancingCapacity(capacityInput);
  const systems = Object.fromEntries((['PRICE', 'SAC'] as const).map((system) => {
    const systemCapacity = capacity[system];
    const initialPayments = calculatePeakPayment(capacityInput, systemCapacity.initialLimit, system);
    const initialAvailable = systemCapacity.initialLimit > 0 &&
      Number.isFinite(initialPayments.initialPayment) && Number.isFinite(initialPayments.peakPayment);
    const safeAvailable = systemCapacity.safeLimit > 0 &&
      Number.isFinite(systemCapacity.initialPayment) && Number.isFinite(systemCapacity.peakPayment);
    return [system, {
      initial: initialAvailable ? {
        principal: systemCapacity.initialLimit,
        propertyValue: systemCapacity.initialLimit + availableDownPayment,
        ...initialPayments,
      } : null,
      safe: safeAvailable ? {
        principal: systemCapacity.safeLimit,
        propertyValue: systemCapacity.safeLimit + availableDownPayment,
        initialPayment: systemCapacity.initialPayment,
        peakPayment: systemCapacity.peakPayment,
        peakPaymentMonth: systemCapacity.peakPaymentMonth,
      } : null,
    }];
  })) as PaymentAffordabilityResult['systems'];

  return { availableDownPayment, initialCosts: input.initialCosts, systems };
}
