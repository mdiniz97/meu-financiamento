export type AmortSystem = 'SAC' | 'PRICE';
export interface LoanInput {
  system: AmortSystem;
  principal: number;          // saldo devedor informado pelo usuário
  annualRate: number;         // taxa a.a. efetiva (0.10 = 10%)
  months: number;             // nº parcelas informado pelo usuário
  trMonthly: number;          // correção monetária mensal (0.0017)
  insuranceMonthly: number;   // seguro por parcela em R$ (informado pelo usuário)
  insuranceSplit: { taxPct: number; insurancePct: number }; // ex { 0.25, 0.75 }
  bank: string;
}
export interface ExtraPayment { month: number; amount: number } // month 1-based
export interface RecurringExtra { amount: number; every: number; startMonth: number; untilMonth?: number } // aporte de `amount` a cada `every` meses, começando em `startMonth`, opcional até `untilMonth`
export interface FgtsAnnual { amount: number; startMonth?: number; untilMonth?: number } // amortização anual, começando no mês `startMonth` (default 12), opcional até `untilMonth`
export interface FixedPayment { amount: number; startMonth?: number; untilMonth?: number } // paga exatamente `amount`/mês (parcela + aporte), opcional de `startMonth` até `untilMonth`
export interface Strategies {
  extraLumpSum: ExtraPayment[];        // amortizações pontuais
  extraMonthlyPct?: number;            // 0.05 = 5% a mais na parcela
  extraMonthlyPctStartMonth?: number; // % extra a partir do mês X (opcional, default 1)
  extraMonthlyPctUntilMonth?: number;  // % extra só até o mês X (opcional)
  extraMonthlyPctGrowthYearly?: number; // escalada: % extra cresce isso ao ano (0.01 = +1 p.p. ao ano)
  fixedPayment?: FixedPayment;         // pagamento mensal fixo (parcela + aporte)
  fgtsAnnual?: FgtsAnnual;             // amortização anual (mês 12 por padrão)
  recurringExtra?: RecurringExtra;     // aporte recorrente (ex: R$ 10 mil a cada 12 meses a partir do mês 6)
  paySacParcela?: boolean;             // PRICE: pagar a parcela do SAC: a diferença vira amortização extra
  reduceMode: 'payment' | 'term';      // default 'term'
  portability?: { annualRate: number; bank: string; insuranceMonthly: number };
}
export interface Installment {
  month: number; juros: number; amortizacao: number; seguro: number;
  correcao: number; extra: number; parcela: number; saldo: number;
  valorUtil: number; pctValorUtil: number;
}
export interface SimulationMetrics {
  cetRealAnual: number; totalPago: number; totalJuros: number;
  totalAmortizacao: number; totalCorrecao: number; totalSeguro: number;
  dividaAlemDaDivida: number; dividaCai12m: number; dividaCai3a: number;
  saldoZeroAt: number; parcelaPagaDividaPct: number;
  /** true quando o modo "reduzir parcela" conseguiu reduzir a parcela de fato */
  paymentApplied: boolean;
}
export interface SimulationResult {
  system: AmortSystem; input: LoanInput; strategies: Strategies;
  installments: Installment[]; metrics: SimulationMetrics;
}
