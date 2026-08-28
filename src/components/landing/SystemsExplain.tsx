import { CheckIcon, InfoIcon } from "lucide-react";
import { simulate } from "@/lib/finance/engine";
import { priceBreakEven } from "@/lib/finance/insights";
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
const be = priceBreakEven(input, price);

const sacPoints = [
  "Amortiza o saldo devedor desde a primeira parcela",
  "Parcela começa maior e vai caindo com o tempo",
  "Paga menos juros no total",
  "Ideal para quem quer reduzir a dívida mais rápido",
];

const priceProsCount = 3;

const pricePoints = [
  "Parcela inicial ~R$ 2,3 mil menor que o SAC — mais fácil de caber no orçamento",
  "Maior facilidade de aprovação: bancos costumam financiar até 90% do valor do imóvel quando a parcela é menor",
  "Parcela igual do início ao fim",
  `Só passa a amortizar de verdade a partir da ~${be.maxMonths}ª parcela (mais de 18 anos)`,
];

const exampleRows = [
  {
    label: "Parcela inicial",
    priceValue: price.installments[0].parcela,
    sacValue: sac.installments[0].parcela,
    format: "brlApprox" as const,
  },
  {
    label: "Amortização na 1ª parcela",
    priceValue: price.installments[0].amortizacao,
    sacValue: sac.installments[0].amortizacao,
    format: "brlApprox" as const,
  },
  {
    label: "Saldo devedor após 5 anos",
    priceValue: price.installments[59].saldo,
    sacValue: sac.installments[59].saldo,
    format: "brlMilhaoApprox" as const,
  },
  {
    label: "Juros totais em 30 anos",
    priceValue: price.metrics.totalJuros,
    sacValue: sac.metrics.totalJuros,
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
              <span className="text-xs font-medium text-muted-foreground">
                Sistema de Amortização Constante
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight">SAC</h3>
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
              <span className="border border-[#92400E] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#92400E] dark:border-amber-400 dark:text-amber-400">
                Atenção nos primeiros anos
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Sistema de Parcelas Constantes
              </span>
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight">PRICE</h3>
            <p className="-mt-2 text-sm text-muted-foreground">
              A parcela é fixa, mas no começo você paga muito mais juro do que
              amortização.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {pricePoints.map((point, i) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  {i < priceProsCount ? (
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-[#92400E] dark:text-amber-400" />
                  )}
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
            <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b border-border px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Comparativo</span>
              <span className="text-right">PRICE</span>
              <span className="text-right">SAC</span>
            </div>
            {exampleRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b border-border px-2 py-3.5 text-sm last:border-0"
              >
                <span className="pr-2 text-muted-foreground">{row.label}</span>
                <AnimatedNumber
                  value={row.priceValue}
                  format={row.format}
                  className="text-right font-mono font-medium tabular-nums"
                />
                <AnimatedNumber
                  value={row.sacValue}
                  format={row.format}
                  className="text-right font-mono font-semibold tabular-nums text-primary"
                />
              </div>
            ))}
          </div>
          <p className="px-6 pb-4 pt-1 text-xs text-muted-foreground">
            Valores calculados com o nosso motor de simulação, com taxa de 10% a.a. e TR de
            0,17% a.m. O resultado exato depende das taxas do seu contrato: simule o seu caso.
          </p>
        </div>
      </div>
    </section>
  );
}
