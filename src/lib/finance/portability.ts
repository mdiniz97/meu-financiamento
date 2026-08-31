import { simulate } from './engine';
import type { AmortSystem, LoanInput, SimulationResult } from './types';

const MONETARY_TOLERANCE = 0.005;

export interface PortabilityInput {
  /** saldo devedor atual */
  principal: number;
  /** sistema atual */
  currentSystem: AmortSystem;
  /** taxa atual (a.a.) */
  currentAnnualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  /** parcelas restantes do contrato atual */
  months: number;
  bank: string;
  /** nova taxa da portabilidade (a.a.) */
  newAnnualRate: number;
  /** novo sistema (normalmente o mesmo) */
  newSystem: AmortSystem;
  newInsuranceMonthly: number;
  newBank: string;
  /** custos da portabilidade (R$, opcional) */
  costs?: number;
}

export interface PortabilityResult {
  keep: SimulationResult;
  ported: SimulationResult;
  /** economia bruta (positivo = portar economiza), sem descontar custos */
  economiaBruta: number;
  /** custos da portabilidade (>= 0) */
  costs: number;
  /** economia líquida = economiaBruta - costs (positivo = vale a pena) */
  economiaLiquida: number;
  /** mês em que a economia acumulada cobre os custos; null se nunca */
  paybackMonth: number | null;
}

function toInput(i: PortabilityInput, system: AmortSystem, annualRate: number, insuranceMonthly: number, bank: string): LoanInput {
  return {
    system,
    principal: i.principal,
    annualRate,
    months: i.months,
    trMonthly: i.trMonthly,
    insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank,
  };
}

/** Compara manter o contrato atual vs portar para nova taxa/banco/sistema. */
export function comparePortability(i: PortabilityInput): PortabilityResult {
  const noStrategy = { extraLumpSum: [], reduceMode: 'term' as const };
  const keep = simulate(
    toInput(i, i.currentSystem, i.currentAnnualRate, i.insuranceMonthly, i.bank),
    noStrategy
  );
  const ported = simulate(
    toInput(i, i.newSystem, i.newAnnualRate, i.newInsuranceMonthly, i.newBank),
    noStrategy
  );

  const costs = Math.max(0, i.costs ?? 0);
  const economiaBruta = keep.metrics.totalPago - ported.metrics.totalPago;
  const economiaLiquida = economiaBruta - costs;
  let acumulado = -costs;
  const n = Math.max(keep.installments.length, ported.installments.length);
  const accumulatedSavings: number[] = [];
  for (let t = 0; t < n; t++) {
    const parcelaKeep = keep.installments[t]?.parcela ?? 0;
    const parcelaPorted = ported.installments[t]?.parcela ?? 0;
    acumulado += parcelaKeep - parcelaPorted;
    accumulatedSavings.push(acumulado);
  }
  let paybackMonth: number | null = null;
  let futureMinimum = Infinity;
  const hadMeaningfulPriorDeficit = costs > MONETARY_TOLERANCE;
  for (let t = accumulatedSavings.length - 1; t >= 0; t--) {
    futureMinimum = Math.min(futureMinimum, accumulatedSavings[t]);
    const recovered = hadMeaningfulPriorDeficit
      ? accumulatedSavings[t] >= -MONETARY_TOLERANCE
      : accumulatedSavings[t] > MONETARY_TOLERANCE;
    if (recovered && futureMinimum >= -MONETARY_TOLERANCE) paybackMonth = t + 1;
  }

  return {
    keep,
    ported,
    economiaBruta,
    costs,
    economiaLiquida,
    paybackMonth,
  };
}

export interface PortabilityBreakEven {
  /** maior taxa (a.a.) em que portar ainda compensa (economia líquida >= 0); null quando nem taxa 0 compensa */
  maxWorthwhileRate: number | null;
  /** true quando 100% a.a. ainda atende, portanto não há limite exato dentro do domínio */
  maxWorthwhileAtCeiling: boolean;
  /**
   * Parcela desejada: null quando nenhum alvo foi informado.
   * Quando informada: maxRate é a maior taxa (a.a.) que ainda atinge a parcela;
   * impossible=true quando nem taxa 0 atinge o alvo (maxRate null nesse caso).
   */
  targetParcela: { maxRate: number | null; impossible: boolean; atCeiling: boolean } | null;
}

/**
 * Busca inteligente da portabilidade: acha a maior taxa do novo banco em que
 * portar ainda vale a pena, e a maior taxa que atinge a parcela desejada.
 */
export function portabilityBreakEven(i: PortabilityInput, targetParcela?: number): PortabilityBreakEven {
  const economiaNa = (rate: number) => comparePortability({ ...i, newAnnualRate: rate }).economiaLiquida;

  let maxWorthwhileRate: number | null = null;
  let maxWorthwhileAtCeiling = false;
  if (economiaNa(0) >= 0) {
    let hi = 1;
    let lo = 0;
    if (economiaNa(hi) >= 0) {
      lo = hi;
      maxWorthwhileAtCeiling = true;
    } else {
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (economiaNa(mid) >= 0) lo = mid;
        else hi = mid;
      }
    }
    maxWorthwhileRate = lo;
  }

  let targetResult: PortabilityBreakEven['targetParcela'] = null;
  if (targetParcela !== undefined && targetParcela > 0) {
    const parcelaNa = (rate: number) =>
      comparePortability({ ...i, newAnnualRate: rate }).ported.installments[0]?.parcela ?? Infinity;
    if (parcelaNa(0) > targetParcela) {
      targetResult = { maxRate: null, impossible: true, atCeiling: false };
    } else {
      const pHi = 1;
      if (parcelaNa(pHi) <= targetParcela) {
        targetResult = { maxRate: pHi, impossible: false, atCeiling: true };
      } else {
        let pLo = 0;
        let pHiBis = pHi;
        for (let k = 0; k < 60; k++) {
          const mid = (pLo + pHiBis) / 2;
          if (parcelaNa(mid) <= targetParcela) pLo = mid;
          else pHiBis = mid;
        }
        targetResult = { maxRate: pLo, impossible: false, atCeiling: false };
      }
    }
  }

  return { maxWorthwhileRate, maxWorthwhileAtCeiling, targetParcela: targetResult };
}

/** Floors a domain boundary to two percentage-point decimals and verifies it remains safe. */
export function safeDisplayedPortabilityRate(
  input: PortabilityInput,
  maxRate: number | null,
  targetParcela?: number
): number | null {
  if (maxRate === null) return null;
  const rate = Math.floor((maxRate + Number.EPSILON) * 10_000) / 10_000;
  const result = comparePortability({ ...input, newAnnualRate: rate });
  if (result.economiaLiquida < 0) return null;
  if (targetParcela !== undefined && (result.ported.installments[0]?.parcela ?? Infinity) > targetParcela) {
    return null;
  }
  return rate;
}
