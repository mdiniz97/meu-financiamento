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
  /** % extra mensal para usar todo o orçamento */
  extraMonthlyPct: number;
  /** aporte mensal em R$ (orçamento − parcela) */
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
  // aporte mensal = orçamento − parcela; no modo fixo o pagamento total
  // permanece exatamente o orçamento todo mês
  const extraMonthlyAmount = Math.max(0, Math.min(i.maxPayment - parcela, parcela));
  const extraMonthlyPct = parcela > 0 ? extraMonthlyAmount / parcela : 0;
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
  } else if (extraMonthlyPct > 0) {
    strategies.extraMonthlyPct = extraMonthlyPct;
  }
  const result = simulate(input, strategies);
  return { system, months, parcela, extraMonthlyPct, extraMonthlyAmount, result };
}

function trySimulateCandidate(
  system: AmortSystem,
  months: number,
  input: SmartInput,
  monthlyRate: number,
  reduceMode: 'term' | 'payment'
): SmartCandidate | null {
  try {
    return simulateCandidate(system, months, input, monthlyRate, reduceMode);
  } catch {
    return null;
  }
}

/**
 * Cálculo inteligente: dado o orçamento mensal, encontra o melhor
 * (sistema × prazo) que caiba no orçamento, usando a diferença
 * (orçamento − parcela) como aporte mensal, minimizando o total pago.
 */
export function recommendSmart(i: SmartInput): SmartRecommendation {
  const m = convertAnnualToMonthly(i.annualRate);
  const minMonths = i.minMonths ?? 60;
  const maxMonths = Math.min(i.maxMonths ?? 420, 600);

  const candidates: SmartCandidate[] = [];
  const minN: Record<AmortSystem, number | null> = { PRICE: null, SAC: null };
  // no modo pagamento fixo, deixa folga no orçamento (parcela <= 85% do
  // orçamento quando possível) para o aporte absorver o crescimento da parcela
  // pela TR: senão a parcela estoura o valor fixo em poucos meses
  const fixedLimit = i.fixedPayment !== false ? Math.min(i.maxPayment, i.maxPayment * 0.85) : i.maxPayment;
  for (const system of ['PRICE', 'SAC'] as AmortSystem[]) {
    const limit = i.fixedPayment !== false ? fixedLimit : i.maxPayment;
    if (parcela1(system, maxMonths, i, m) > limit) {
      // sem folga disponível: aceita o orçamento cheio para ainda ser viável
      if (i.fixedPayment !== false && parcela1(system, maxMonths, i, m) > i.maxPayment) continue;
      let lo = minMonths, hi = maxMonths;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (parcela1(system, mid, i, m) <= i.maxPayment) hi = mid;
        else lo = mid + 1;
      }
      minN[system] = lo;
    } else {
      let lo = minMonths, hi = maxMonths;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (parcela1(system, mid, i, m) <= limit) hi = mid;
        else lo = mid + 1;
      }
      minN[system] = lo;
    }
    const nMin = minN[system]!;

    // avalia a faixa com passo 6 meses e refina ±5 em torno do melhor,
    // para cada modo de redução (prazo ou parcela)
    for (const mode of ['term', 'payment'] as const) {
      const steps: number[] = [];
      for (let n = nMin; n <= maxMonths; n += 6) steps.push(n);
      if (steps[steps.length - 1] !== maxMonths) steps.push(maxMonths);

      let bestN = nMin;
      let bestTotal = Infinity;
      // no modo payment, o pagamento natural (sem o aporte fixo) não pode
      // estourar o orçamento em nenhum mês
      const candidatoValido = (c: SmartCandidate) =>
        mode !== 'payment' ||
        c.result.installments.every((inst) => inst.parcela - inst.extra <= i.maxPayment + 1);
      for (const n of steps) {
        const c = trySimulateCandidate(system, n, i, m, mode);
        if (c && candidatoValido(c) && c.result.metrics.totalPago < bestTotal) {
          bestTotal = c.result.metrics.totalPago;
          bestN = n;
        }
      }
      for (let n = Math.max(nMin, bestN - 5); n <= Math.min(maxMonths, bestN + 5); n++) {
        const c = trySimulateCandidate(system, n, i, m, mode);
        if (c && candidatoValido(c) && c.result.metrics.totalPago < bestTotal) {
          bestTotal = c.result.metrics.totalPago;
          bestN = n;
        }
      }
      if (Number.isFinite(bestTotal)) {
        const candidate = trySimulateCandidate(system, bestN, i, m, mode);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  candidates.sort(
    (a, b) =>
      (i.preferredSystem ? Number(b.system === i.preferredSystem) - Number(a.system === i.preferredSystem) : 0) ||
      a.result.metrics.totalPago - b.result.metrics.totalPago ||
      a.result.metrics.saldoZeroAt - b.result.metrics.saldoZeroAt
  );

  const minBudget = Math.min(parcela1('PRICE', maxMonths, i, m), parcela1('SAC', maxMonths, i, m));
  const comparison: SystemComparison[] = (['PRICE', 'SAC'] as AmortSystem[]).map((system) => ({
    system,
    feasible: minN[system] !== null,
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
        ? pmt((1 + m) * (1 + i.trMonthly) - 1, maxMonths, i.principal) + i.insuranceMonthly
        : pmt(i.trMonthly, maxMonths, i.principal) + i.principal * m + i.insuranceMonthly;
    paymentMinParcela = Number.isFinite(minimo) ? minimo : null;
  }
  const maxTerms: SmartCandidate[] = (['PRICE', 'SAC'] as AmortSystem[])
    .filter((system) => minN[system] !== null)
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
