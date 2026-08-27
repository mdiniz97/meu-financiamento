import { simulate } from "@/lib/finance/engine";
import type { LoanInput } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

const input: LoanInput = {
  system: "PRICE", principal: 1000000, annualRate: 0.10, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 0,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: "Caixa",
};
const none = { extraLumpSum: [], reduceMode: "term" as const };
const price = simulate({ ...input, system: "PRICE" }, none);
const sac = simulate({ ...input, system: "SAC" }, none);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const sidebarItems = ["Visão geral", "Comparativo", "Amortização", "Gráficos"];

const rows = [
  { label: "Parcela inicial", price: brl(price.installments[0].parcela), sac: brl(sac.installments[0].parcela) },
  { label: "Amortização na 1ª parcela", price: brl(price.installments[0].amortizacao), sac: brl(sac.installments[0].amortizacao) },
  { label: "Juros totais em 30 anos", price: brl(price.metrics.totalJuros), sac: brl(sac.metrics.totalJuros) },
];

export function DashboardPreview() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Veja o que você encontra na análise completa
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Gráficos de evolução da dívida, tabela de amortização comparativa e o
            break-even entre SAC e PRICE — tudo em um só lugar.
          </p>
        </div>

        <div className="mt-12 grid border border-border sm:grid-cols-[160px_1fr]">
          <div className="hidden flex-col divide-y divide-border border-r border-border sm:flex">
            {sidebarItems.map((item, i) => (
              <span
                key={item}
                className={cn(
                  "p-4 text-xs",
                  i === 1 ? "font-semibold text-primary" : "text-muted-foreground"
                )}
              >
                {item}
              </span>
            ))}
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Comparativo SAC × PRICE</span>
              <span className="text-right">PRICE</span>
              <span className="text-right">SAC</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-border py-2.5 text-sm last:border-0"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="text-right font-mono tabular-nums">{row.price}</span>
                <span className="text-right font-mono tabular-nums text-primary">{row.sac}</span>
              </div>
            ))}
            <svg viewBox="0 0 300 80" className="mt-4 w-full text-border" aria-hidden="true">
              <polyline
                points="0,8 60,20 120,38 180,54 240,66 300,74"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <polyline
                points="0,6 60,14 120,26 180,42 240,58 300,72"
                fill="none"
                className="text-primary"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
