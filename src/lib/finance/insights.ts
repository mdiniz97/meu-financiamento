import { convertAnnualToMonthly, pmt, simulate } from './engine';
import type { LoanInput, SimulationResult } from './types';

export interface PriceBreakEven {
  /** parcela mínima (com seguro) para a dívida começar a cair: saldo × (taxa mensal + TR) + seguro */
  minPayment: number;
  /** prazo máximo (meses) para abater a dívida desde a 1ª parcela; Infinity quando TR = 0 */
  maxMonths: number;
  /** parcela (com seguro) se o financiamento já começasse no prazo ideal (maxMonths); null quando TR = 0 */
  idealPayment: number | null;
  /** aporte mensal extra (R$) necessário para abater desde o mês 1 no prazo atual; 0 se já abate */
  requiredExtraMonthly: number;
  /** mesmo aporte em % da parcela contratual */
  requiredExtraPct: number;
  /** percentual mensal total que substitui qualquer percentual atual */
  requiredTotalExtraPct: number;
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
  const idealPayment = Number.isFinite(maxMonths)
    ? pmt(m, maxMonths, input.principal) + input.insuranceMonthly
    : null;
  // o que o usuário já paga por mês (reflete as estratégias atuais, sem aportes pontuais)
  const pagamentoAtual = result && result.installments.length > 0 ? recurringParcela(result) : 0;
  const parcelaReferencia = pagamentoAtual > 0
    ? pagamentoAtual
    : pmt(m, input.months, input.principal) + input.insuranceMonthly;
  const requiredExtraMonthly = Math.max(0, minPayment - parcelaReferencia);
  const requiredExtraPct = requiredExtraMonthly / parcelaReferencia;
  const contractualPayment = recurringParcela(simulate(input, { extraLumpSum: [], reduceMode: 'term' }));
  const strategiesWithoutPercent = result
    ? {
        ...result.strategies,
        extraMonthlyPct: undefined,
        extraMonthlyPctStartMonth: undefined,
        extraMonthlyPctUntilMonth: undefined,
        extraMonthlyPctReduceMode: undefined,
      }
    : { extraLumpSum: [], reduceMode: 'term' as const };
  const nonPercentPayment = recurringParcela(simulate(input, strategiesWithoutPercent));
  const requiredTotalExtraPct = contractualPayment > 0
    ? Math.max(0, minPayment - nonPercentPayment) / contractualPayment
    : 0;
  const monthsUntilAmortize =
    (result?.installments ?? []).find((i) => i.amortizacao > i.correcao)?.month ?? null;
  return {
    minPayment,
    maxMonths,
    idealPayment,
    requiredExtraMonthly,
    requiredExtraPct,
    requiredTotalExtraPct,
    monthsUntilAmortize,
  };
}

/**
 * Parcela recorrente (o que o usuário paga todo mês), ignorando aportes pontuais
 * (lump sum) que aparecem só no mês em que foram agendados. Aportes recorrentes
 * (% extra, FGTS, aporte a cada X meses) são mantidos quando caem no mês 1.
 */
export function recurringParcela(result: SimulationResult): number {
  const first = result.installments[0];
  if (!first) return 0;
  const lumpsNoMes1 = (result.strategies.extraLumpSum ?? [])
    .filter((e) => e.month === first.month)
    .reduce((acc, e) => acc + e.amount, 0);
  return Math.max(0, first.parcela - lumpsNoMes1);
}

export interface SacVsPrice {
  parcela1Sac: number;
  parcela1Price: number;
  ultimaParcelaSac: number;
  /** primeiro mês em que a parcela SAC fica menor que a PRICE; null se nunca */
  crossingMonth: number | null;
  /** economia do SAC vs PRICE no total pago (positivo = SAC mais barato) */
  economiaVsPrice: number;
  /** quanto a dívida cai em 12 meses no SAC */
  dividaCai12mSac: number;
}

/** Comparação SAC vs PRICE no mesmo contrato (cenário base, sem estratégias). */
export function sacVsPrice(input: LoanInput): SacVsPrice {
  const noStrategy = { extraLumpSum: [], reduceMode: 'term' as const };
  const sac = simulate({ ...input, system: 'SAC' }, noStrategy);
  const price = simulate({ ...input, system: 'PRICE' }, noStrategy);
  const sacInst = sac.installments;
  const priceInst = price.installments;
  let crossingMonth: number | null = null;
  for (let i = 0; i < priceInst.length; i++) {
    if (sacInst[i] && sacInst[i].parcela < priceInst[i].parcela) {
      crossingMonth = i + 1;
      break;
    }
  }
  return {
    parcela1Sac: sacInst[0]?.parcela ?? 0,
    parcela1Price: priceInst[0]?.parcela ?? 0,
    ultimaParcelaSac: sacInst[sacInst.length - 1]?.parcela ?? 0,
    crossingMonth,
    economiaVsPrice: price.metrics.totalPago - sac.metrics.totalPago,
    dividaCai12mSac: sac.metrics.dividaCai12m,
  };
}
