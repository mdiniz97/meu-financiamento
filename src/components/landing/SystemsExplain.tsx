import { CheckIcon } from "lucide-react";
import { simulate } from "@/lib/finance/engine";
import type { LoanInput } from "@/lib/finance/types";
import { AnimatedNumber } from "@/components/landing/motion-primitives";

const input: LoanInput = {
  system: "PRICE", principal: 1000000, annualRate: 0.10, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 0,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: "Caixa",
};
const none = { extraLumpSum: [], reduceMode: "term" as const };
const price = simulate({ ...input, system: "PRICE" }, none);
const sac = simulate({ ...input, system: "SAC" }, none);
const smart = simulate(
  { ...input, system: "PRICE" },
  { extraLumpSum: [], reduceMode: "term", extraMonthlyPct: 0.113 }
);

const sacPoints = [
  "Amortiza o saldo devedor desde a primeira parcela",
  "Parcela começa maior e vai caindo com o tempo",
  "Paga menos juros no total",
  "Ideal para quem quer reduzir a dívida mais rápido",
];

const pricePoints = [
  "Parcela inicial menor que o SAC, mais fácil de caber no orçamento",
  "Maior facilidade de aprovação, já que a parcela menor pesa menos na renda exigida pelo banco",
  "Parcela igual do início ao fim",
  "Até 90% de financiamento do valor do imóvel",
];

const exampleRows = [
  {
    label: "Parcela inicial",
    priceValue: price.installments[0].parcela,
    sacValue: sac.installments[0].parcela,
    smartValue: smart.installments[0].parcela,
    format: "brlApprox" as const,
  },
  {
    label: "Amortização na 1ª parcela",
    priceValue: price.installments[0].amortizacao,
    sacValue: sac.installments[0].amortizacao,
    smartValue: smart.installments[0].amortizacao,
    format: "brlApprox" as const,
  },
  {
    label: "Saldo devedor após 5 anos",
    priceValue: price.installments[59].saldo,
    sacValue: sac.installments[59].saldo,
    smartValue: smart.installments[59].saldo,
    format: "brlMilhaoApprox" as const,
  },
  {
    label: "Juros totais em 30 anos",
    priceValue: price.metrics.totalJuros,
    sacValue: sac.metrics.totalJuros,
    smartValue: smart.metrics.totalJuros,
    format: "brlMilhaoApprox" as const,
  },
];

export function SystemsExplain() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            SAC vs PRICE: a diferença custa caro
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Os dois sistemas pagam o mesmo empréstimo, mas a forma de amortizar
            muda tudo: no total, a diferença passa de centenas de milhares de
            reais.
          </p>
        </div>

        <div className="mt-12 grid border border-border lg:grid-cols-2 lg:divide-x lg:divide-border">
          <div className="flex flex-col gap-4 border-b border-border p-6 sm:p-8 lg:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Amortiza desde o início
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight">SAC</h3>
            <p className="-mt-4 text-xs font-medium text-muted-foreground">
              Sistema de Amortização Constante
            </p>
            <p className="-mt-2 text-sm text-muted-foreground">
              A parcela começa maior e cai a cada mês, porque a amortização é
              fixa desde a primeira parcela.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {sacPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Atenção nos primeiros anos
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight">PRICE</h3>
            <p className="-mt-4 text-xs font-medium text-muted-foreground">
              Sistema de Parcelas Constantes
            </p>
            <p className="-mt-2 text-sm text-muted-foreground">
              A parcela é fixa, mas no começo você paga muito mais juro do que
              amortização.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {pricePoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border border-border">
          <div className="border-b border-border px-6 py-4">
            <span className="text-sm font-semibold">
              Exemplo numérico: financiamento de R$ 1.000.000 em 360 meses (10% a.a., TR 0,17% a.m.)
            </span>
          </div>
          <div className="px-6 py-2">
            <div className="grid grid-cols-[1.3fr_0.85fr_0.85fr_1.2fr] gap-2 border-b border-border px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Comparativo</span>
              <span className="text-right">PRICE</span>
              <span className="text-right">SAC</span>
              <span className="text-right normal-case text-primary">Com amortizador inteligente</span>
            </div>
            {exampleRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.3fr_0.85fr_0.85fr_1.2fr] gap-2 border-b border-border px-2 py-3.5 text-sm last:border-0"
              >
                <span className="pr-2 text-muted-foreground">{row.label}</span>
                <AnimatedNumber
                  value={row.priceValue}
                  format={row.format}
                  className="text-right font-mono font-medium font-mono tabular-nums"
                />
                <AnimatedNumber
                  value={row.sacValue}
                  format={row.format}
                  className="text-right font-mono font-semibold font-mono tabular-nums"
                />
                <AnimatedNumber
                  value={row.smartValue}
                  format={row.format}
                  className="text-right font-mono font-bold font-mono tabular-nums text-primary"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
