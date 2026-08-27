import { simulate } from './engine';
import type { AmortSystem, LoanInput, SimulationResult } from './types';

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
  /** economia total (positivo = portar economiza) */
  economia: number;
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
  let paybackMonth: number | null = null;
  let acumulado = -costs;
  const n = Math.max(keep.installments.length, ported.installments.length);
  for (let t = 0; t < n; t++) {
    const parcelaKeep = keep.installments[t]?.parcela ?? 0;
    const parcelaPorted = ported.installments[t]?.parcela ?? 0;
    acumulado += parcelaKeep - parcelaPorted;
    if (acumulado >= 0) {
      paybackMonth = t + 1;
      break;
    }
  }

  return {
    keep,
    ported,
    economia: keep.metrics.totalPago - ported.metrics.totalPago,
    paybackMonth,
  };
}

export interface PortabilityBreakEven {
  /** maior taxa (a.a.) em que portar ainda compensa (economia >= 0) */
  maxWorthwhileRate: number;
  /** maior taxa (a.a.) para atingir a parcela desejada; null se impossível nem a taxa 0 */
  maxRateForTargetParcela: number | null;
}

/**
 * Busca inteligente da portabilidade: acha a maior taxa do novo banco em que
 * portar ainda vale a pena, e a maior taxa que atinge a parcela desejada.
 */
export function portabilityBreakEven(i: PortabilityInput, targetParcela?: number): PortabilityBreakEven {
  const economiaNa = (rate: number) => comparePortability({ ...i, newAnnualRate: rate }).economia;

  let hi = Math.max(0.5, i.currentAnnualRate * 2);
  let lo = 0;
  if (economiaNa(hi) >= 0) {
    // até 2× a taxa atual ainda compensa: retorna o teto do intervalo
    lo = hi;
  } else {
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (economiaNa(mid) >= 0) lo = mid;
      else hi = mid;
    }
  }

  let maxRateForTargetParcela: number | null = null;
  if (targetParcela !== undefined && targetParcela > 0) {
    const parcelaNa = (rate: number) =>
      comparePortability({ ...i, newAnnualRate: rate }).ported.installments[0]?.parcela ?? Infinity;
    if (parcelaNa(0) > targetParcela) {
      maxRateForTargetParcela = null;
    } else {
      const pHi = hi > 0 ? hi : 0.5;
      if (parcelaNa(pHi) <= targetParcela) {
        // todo o intervalo [0, pHi] atende a parcela desejada
        maxRateForTargetParcela = pHi;
      } else {
        let pLo = 0;
        let pHiBis = pHi;
        for (let k = 0; k < 60; k++) {
          const mid = (pLo + pHiBis) / 2;
          if (parcelaNa(mid) <= targetParcela) pLo = mid;
          else pHiBis = mid;
        }
        maxRateForTargetParcela = pLo;
      }
    }
  }

  return { maxWorthwhileRate: lo, maxRateForTargetParcela };
}
