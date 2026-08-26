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
export interface Strategies {
  extraLumpSum: ExtraPayment[];      // amortizações pontuais
  extraMonthlyPct?: number;          // 0.05 = 5% a mais na parcela
  fgtsAnnual?: number;               // R$ amortizados todo mês 12, 24, 36...
  reduceMode: 'payment' | 'term';    // default 'term'
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
}
export interface SimulationResult {
  system: AmortSystem; input: LoanInput; strategies: Strategies;
  installments: Installment[]; metrics: SimulationMetrics;
}
