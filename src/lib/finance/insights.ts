import { convertAnnualToMonthly } from './engine';
import type { LoanInput, SimulationResult } from './types';

export interface PriceBreakEven {
  /** parcela mínima (com seguro) para a dívida começar a cair: saldo × (taxa mensal + TR) + seguro */
  minPayment: number;
  /** prazo máximo (meses) para abater a dívida desde a 1ª parcela; Infinity quando TR = 0 */
  maxMonths: number;
  /** primeiro mês em que a amortização supera a correção monetária; null se nunca (não deve ocorrer) */
  monthsUntilAmortize: number | null;
}

export function priceBreakEven(input: LoanInput, result?: SimulationResult): PriceBreakEven {
  const m = convertAnnualToMonthly(input.annualRate);
  const minPayment = input.principal * (m + input.trMonthly) + input.insuranceMonthly;
  const maxMonths =
    input.trMonthly <= 0
      ? Infinity
      : Math.floor(Math.log((m + input.trMonthly) / input.trMonthly) / Math.log(1 + m));
  const monthsUntilAmortize =
    (result?.installments ?? []).find((i) => i.amortizacao > i.correcao)?.month ?? null;
  return { minPayment, maxMonths, monthsUntilAmortize };
}
