import { simulate } from "@/lib/finance/engine";
import type { LoanInput } from "@/lib/finance/types";
import { DashboardTabs } from "@/components/landing/DashboardTabs";

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

const comparativoRows = [
  { label: "Parcela inicial", price: brl(price.installments[0].parcela), sac: brl(sac.installments[0].parcela) },
  { label: "Amortização na 1ª parcela", price: brl(price.installments[0].amortizacao), sac: brl(sac.installments[0].amortizacao) },
  { label: "Juros totais em 30 anos", price: brl(price.metrics.totalJuros), sac: brl(sac.metrics.totalJuros) },
];

const amortizacaoMonths = [
  { month: 1, index: 0 },
  { month: 12, index: 11 },
  { month: 60, index: 59 },
  { month: 120, index: 119 },
  { month: 360, index: 359 },
];

const amortizacaoRows = amortizacaoMonths.map(({ month, index }) => ({
  label: `Mês ${month}`,
  price: brl(price.installments[index].amortizacao),
  sac: brl(sac.installments[index].amortizacao),
}));

const parcelaInicialPrice = brl(price.installments[0].parcela);
const parcelaInicialSac = brl(sac.installments[0].parcela);
const economiaTotal = brl(price.metrics.totalJuros - sac.metrics.totalJuros);

export function DashboardPreview() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Veja o que você encontra na análise completa
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Gráficos de evolução da dívida, tabela de amortização comparativa e o
            break-even entre SAC e PRICE: tudo em um só lugar.
          </p>
        </div>

        <DashboardTabs
          sidebarItems={sidebarItems}
          comparativoRows={comparativoRows}
          amortizacaoRows={amortizacaoRows}
          parcelaInicialPrice={parcelaInicialPrice}
          parcelaInicialSac={parcelaInicialSac}
          economiaTotal={economiaTotal}
        />
      </div>
    </section>
  );
}
