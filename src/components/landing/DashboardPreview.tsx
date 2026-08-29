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
const smart = simulate(
  { ...input, system: "PRICE" },
  { extraLumpSum: [], reduceMode: "term", extraMonthlyPct: 0.113 }
);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const sidebarItems = ["Visão geral", "Comparativo", "Amortização", "Gráficos"];

const comparativoRows = [
  {
    label: "Parcela inicial",
    price: brl(price.installments[0].parcela),
    sac: brl(sac.installments[0].parcela),
    smart: brl(smart.installments[0].parcela),
  },
  {
    label: "Amortização na 1ª parcela",
    price: brl(price.installments[0].amortizacao),
    sac: brl(sac.installments[0].amortizacao),
    smart: brl(smart.installments[0].amortizacao),
  },
  {
    label: "Juros totais em 30 anos",
    price: brl(price.metrics.totalJuros),
    sac: brl(sac.metrics.totalJuros),
    smart: brl(smart.metrics.totalJuros),
  },
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
  smart: brl(smart.installments[index]?.amortizacao ?? 0),
}));

const parcelaInicialPrice = brl(price.installments[0].parcela);
const parcelaInicialSac = brl(sac.installments[0].parcela);
const economiaTotal = brl(price.metrics.totalJuros - sac.metrics.totalJuros);

// pontos do gráfico da aba "Gráficos": PRICE e SAC sem estratégia (cinza) e
// amortizador inteligente (roxo) — mesmos dados reais das simulações acima
const W = 300;
const H = 80;
const PAD_Y = 6;

function toChartPoints(saldos: number[]) {
  const pts = saldos.map((saldoRaw, i) => {
    const saldo = Math.max(0, saldoRaw);
    const x = (i / 359) * W;
    const y = PAD_Y + (1 - saldo / input.principal) * (H - PAD_Y * 2);
    // sem arredondar para inteiro: passos de ~0,8px entre meses formariam
    // degraus no SVG; com decimais a curva fica suave
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  // quem quita antes do prazo: estende a linha no saldo zero até a borda direita
  if (saldos.length < 360) pts.push(`${W},${(PAD_Y + H - PAD_Y * 2).toFixed(1)}`);
  return pts.join(' ');
}

const chartSeries = {
  price: toChartPoints(price.installments.map((i) => i.saldo)),
  sac: toChartPoints(sac.installments.map((i) => i.saldo)),
  smart: toChartPoints(smart.installments.map((i) => i.saldo)),
};

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
          chartSeries={chartSeries}
        />
      </div>
    </section>
  );
}
