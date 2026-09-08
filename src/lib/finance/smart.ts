import { convertAnnualToMonthly, pmt, simulate } from './engine';
import type { AmortSystem, LoanInput, SimulationResult, Strategies } from './types';

export interface MaxFinancingInput {
  /** parcela mensal que a pessoa quer pagar (parcela + seguro) */
  maxPayment: number;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  months: number;
}

/**
 * Cálculo inverso: dado o quanto se pode pagar por mês, qual o maior valor
 * financiável em cada sistema (parcela 1 <= maxPayment).
 * PRICE: P = (parcela − seguro) × (1 − (1+m)^−N)/m
 * SAC:   P = (parcela − seguro) / (1/N + m)
 */
export function maxFinancing(i: MaxFinancingInput): { PRICE: number; SAC: number } {
  const m = convertAnnualToMonthly(i.annualRate);
  const disponivel = Math.max(0, i.maxPayment - i.insuranceMonthly);
  const price =
    disponivel > 0
      ? m > 0
        ? (disponivel * (1 - Math.pow(1 + m, -i.months))) / m
        : disponivel * i.months
      : 0;
  const sac = disponivel > 0 ? disponivel / (1 / i.months + m) : 0;
  return { PRICE: Math.floor(price), SAC: Math.floor(sac) };
}

export interface SmartInput {
  principal: number;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  /** orçamento mensal disponível (parcela + aporte) */
  maxPayment: number;
  /** manter o pagamento fixo todo mês (parcela + aporte = orçamento); default true */
  fixedPayment?: boolean;
  /** pagamento fixo só até o mês X (depois paga só a parcela) */
  fixedUntilMonth?: number;
  minMonths?: number;
  maxMonths?: number;
  preferredSystem?: AmortSystem;
}

export interface SmartCandidate {
  system: AmortSystem;
  months: number;
  /** parcela 1 (recorrente, sem aporte) */
  parcela: number;
  /** aporte efetivo da primeira prestacao / parcela; pode exceder 100% no fixo */
  extraMonthlyPct: number;
  /** aporte efetivo em R$ na primeira prestacao */
  extraMonthlyAmount: number;
  result: SimulationResult;
}

export interface SystemComparison {
  system: AmortSystem;
  /** se o sistema cabe no orçamento dentro do prazo máximo */
  feasible: boolean;
  /** menor parcela 1 possível no prazo máximo (mesmo inviável) */
  minParcela: number;
  candidate?: SmartCandidate;
}

export interface SmartRecommendation {
  best: SmartCandidate | null;
  /** melhor candidato de cada sistema (para comparação) */
  alternatives: SmartCandidate[];
  /** PRICE e SAC sempre presentes, viáveis ou não */
  comparison: SystemComparison[];
  /** melhor de cada modo de redução (prazo x parcela) */
  modes: { term: SmartCandidate | null; payment: SmartCandidate | null };
  /** parcela mínima que abate a dívida no prazo máximo (para o modo payment); null se viável */
  paymentMinParcela: number | null;
  /** PRICE e SAC entrando já no prazo máximo (viáveis), para comparar com o recomendado */
  maxTerms: SmartCandidate[];
  infeasible: boolean;
  /** menor orçamento viável no prazo máximo */
  minBudget: number;
}

function parcela1(system: AmortSystem, months: number, i: SmartInput, m: number): number {
  return system === 'PRICE'
    ? pmt(m, months, i.principal) + i.insuranceMonthly
    : i.principal / months + i.principal * m + i.insuranceMonthly;
}

function simulateCandidate(
  system: AmortSystem,
  months: number,
  i: SmartInput,
  m: number,
  reduceMode: 'term' | 'payment'
): SmartCandidate {
  const parcela = parcela1(system, months, i, m);
  const input: LoanInput = {
    system,
    principal: i.principal,
    annualRate: i.annualRate,
    months,
    trMonthly: i.trMonthly,
    insuranceMonthly: i.insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
    bank: i.bank,
  };
  const strategies: Strategies = { extraLumpSum: [], reduceMode };
  if (i.fixedPayment !== false) {
    const until = i.fixedUntilMonth;
    strategies.fixedPayment = {
      amount: i.maxPayment,
      ...(Number.isInteger(until) && until !== undefined && until >= 1
        ? { untilMonth: Math.min(until, months) }
        : {}),
    };
  } else {
    const extraMonthlyPct = parcela > 0 ? Math.max(0, Math.min((i.maxPayment - parcela) / parcela, 1)) : 0;
    if (extraMonthlyPct > 0) strategies.extraMonthlyPct = extraMonthlyPct;
  }
  const result = simulate(input, strategies);
  const first = result.installments[0];
  const actualParcela = first.parcela - first.extra;
  const extraMonthlyAmount = first.extra;
  const extraMonthlyPct = actualParcela > 0 ? extraMonthlyAmount / actualParcela : 0;
  return { system, months, parcela: actualParcela, extraMonthlyPct, extraMonthlyAmount, result };
}

function trySimulateCandidate(
  system: AmortSystem,
  months: number,
  input: SmartInput,
  monthlyRate: number,
  reduceMode: 'term' | 'payment'
): SmartCandidate | null {
  try {
    const candidate = simulateCandidate(system, months, input, monthlyRate, reduceMode);
    // O teto inclui aportes e continua valendo depois do fim da janela fixa.
    const budgetCents = Math.round(input.maxPayment * 100);
    return candidate.result.installments.every((inst) => Math.round(inst.parcela * 100) <= budgetCents)
      ? candidate
      : null;
  } catch {
    return null;
  }
}

/**
 * Amortizador inteligente: dado o orçamento mensal, encontra o melhor
 * (sistema × prazo) que caiba no orçamento, usando a diferença
 * (orçamento − parcela) como aporte mensal, minimizando o total pago.
 */
export function recommendSmart(i: SmartInput): SmartRecommendation {
  const m = convertAnnualToMonthly(i.annualRate);
  const minMonths = i.minMonths ?? 60;
  const maxMonths = Math.min(i.maxMonths ?? 420, 600);

  const candidates: SmartCandidate[] = [];
  const budgetCents = Math.round(i.maxPayment * 100);
  for (const system of ['PRICE', 'SAC'] as AmortSystem[]) {
    // Janelas e mudancas de modo impedem inferir viabilidade pela parcela 1.
    // Avalia cada prazo elegivel, sem saltar candidatos entre passos da busca.
    for (const mode of ['term', 'payment'] as const) {
      let best: SmartCandidate | null = null;
      for (let n = minMonths; n <= maxMonths; n++) {
        if (Math.round(parcela1(system, n, i, m) * 100) > budgetCents) continue;
        const c = trySimulateCandidate(system, n, i, m, mode);
        if (c && (!best || c.result.metrics.totalPago < best.result.metrics.totalPago ||
          (c.result.metrics.totalPago === best.result.metrics.totalPago &&
            c.result.metrics.saldoZeroAt < best.result.metrics.saldoZeroAt))) {
          best = c;
        }
      }
      if (best) candidates.push(best);
    }
  }

  candidates.sort(
    (a, b) =>
      (i.preferredSystem ? Number(b.system === i.preferredSystem) - Number(a.system === i.preferredSystem) : 0) ||
      a.result.metrics.totalPago - b.result.metrics.totalPago ||
      a.result.metrics.saldoZeroAt - b.result.metrics.saldoZeroAt
  );

  let minBudget = Infinity;
  for (const system of ['PRICE', 'SAC'] as const) {
    const firstPayment = parcela1(system, maxMonths, i, m);
    for (const mode of ['term', 'payment'] as const) {
      let lo = Math.max(0, Math.round(firstPayment * 100) - 1);
      // No fixo este valor quita no mes 1; no percentual ja satura o limite de 100%.
      let hi = Math.ceil(Math.max(
        firstPayment * 2,
        i.principal * (1 + m + i.trMonthly) + i.insuranceMonthly
      ) * 100);
      try {
        const upper = simulateCandidate(system, maxMonths, { ...i, maxPayment: hi / 100 }, m, mode);
        hi = Math.max(hi, ...upper.result.installments.map((inst) => Math.round(inst.parcela * 100)));
      } catch {
        continue;
      }
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (trySimulateCandidate(system, maxMonths, { ...i, maxPayment: mid / 100 }, m, mode)) hi = mid;
        else lo = mid;
      }
      minBudget = Math.min(minBudget, hi / 100);
    }
  }
  const comparison: SystemComparison[] = (['PRICE', 'SAC'] as AmortSystem[]).map((system) => ({
    system,
    feasible: candidates.some((c) => c.system === system),
    minParcela: parcela1(system, maxMonths, i, m),
    candidate: candidates.find((c) => c.system === system),
  }));
  const best = candidates[0] ?? null;
  const bestMode = best?.result.strategies.reduceMode ?? 'term';
  const modes: { term: SmartCandidate | null; payment: SmartCandidate | null } = {
    term: candidates.find((c) => c.result.strategies.reduceMode === 'term') ?? null,
    payment: candidates.find((c) => c.result.strategies.reduceMode === 'payment') ?? null,
  };
  // quando o modo payment é inviável, mostra a parcela mínima que abate
  let paymentMinParcela: number | null = null;
  if (modes.payment === null && best) {
    const minimo =
      best.system === 'PRICE'
        ? pmt(m + i.trMonthly, maxMonths, i.principal) + i.insuranceMonthly
        : pmt(i.trMonthly, maxMonths, i.principal) + i.principal * m + i.insuranceMonthly;
    paymentMinParcela = Number.isFinite(minimo) ? minimo : null;
  }
  const maxTerms: SmartCandidate[] = (['PRICE', 'SAC'] as AmortSystem[])
    .filter((system) => candidates.some((c) => c.system === system))
    .flatMap((system) => trySimulateCandidate(system, maxMonths, i, m, bestMode) ?? []);

  return {
    best,
    alternatives: candidates,
    comparison,
    modes,
    paymentMinParcela,
    maxTerms,
    infeasible: candidates.length === 0,
    minBudget,
  };
}
