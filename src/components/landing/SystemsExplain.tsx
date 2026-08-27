import { CheckIcon, InfoIcon } from "lucide-react";
import { simulate } from "@/lib/finance/engine";
import { priceBreakEven } from "@/lib/finance/insights";
import type { LoanInput } from "@/lib/finance/types";

const input: LoanInput = {
  system: "PRICE", principal: 1000000, annualRate: 0.10, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 0,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: "Caixa",
};
const none = { extraLumpSum: [], reduceMode: "term" as const };
const price = simulate({ ...input, system: "PRICE" }, none);
const sac = simulate({ ...input, system: "SAC" }, none);
const be = priceBreakEven(input, price);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const brlMilhao = (v: number) => (v / 1_000_000).toFixed(v > 1_000_000 ? 2 : 3).replace(".", ",") + " mi";

const sacPoints = [
  "Amortiza o saldo devedor desde a primeira parcela",
  "Parcela começa maior e vai caindo com o tempo",
  "Paga menos juros no total",
  "Ideal para quem quer reduzir a dívida mais rápido",
];

const pricePoints = [
  "Parcela igual do início ao fim",
  "No começo, quase tudo é juro e a amortização é mínima",
  `No exemplo abaixo, a dívida até cresce nos primeiros anos (por causa da TR)`,
  `Só passa a amortizar de verdade a partir da ~${be.maxMonths}ª parcela (mais de 18 anos)`,
];

const exampleRows = [
  { label: "Parcela inicial", price: `~${brl(price.installments[0].parcela)}`, sac: `~${brl(sac.installments[0].parcela)}` },
  { label: "Amortização na 1ª parcela", price: `~${brl(price.installments[0].amortizacao)}`, sac: `~${brl(sac.installments[0].amortizacao)}` },
  { label: "Saldo devedor após 5 anos", price: `~${brlMilhao(price.installments[59].saldo)}`, sac: `~${brlMilhao(sac.installments[59].saldo)}` },
  { label: "Juros totais em 30 anos", price: `~${brlMilhao(price.metrics.totalJuros)}`, sac: `~${brlMilhao(sac.metrics.totalJuros)}` },
];

export function SystemsExplain() {
  return (
    <section className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            SAC vs PRICE: a diferença custa caro
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Os dois sistemas pagam o mesmo empréstimo, mas a forma de amortizar
            muda tudo: no total, a diferença passa de centenas de milhares de
            reais.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl bg-[#F5F5F5] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#820AD1] px-3 py-1 text-xs font-semibold text-white">
                Amortiza desde o início
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Sistema de Amortização Constante
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">SAC</h3>
            <p className="-mt-2 text-sm text-muted-foreground">
              A parcela começa maior e cai a cada mês, porque a amortização é
              fixa desde a primeira parcela.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {sacPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#820AD1]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-[#F5F5F5] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FFA000] px-3 py-1 text-xs font-semibold text-white">
                Atenção nos primeiros anos
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                Sistema de Parcelas Constantes
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">PRICE</h3>
            <p className="-mt-2 text-sm text-muted-foreground">
              A parcela é fixa, mas no começo você paga muito mais juro do que
              amortização.
            </p>
            <ul className="mt-2 flex flex-col gap-3">
              {pricePoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <InfoIcon className="mt-0.5 size-4 shrink-0 text-[#FFA000]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-[#F5F5F5]">
          <div className="flex items-center gap-2 border-b border-black/5 bg-white px-6 py-4">
            <span className="text-sm font-semibold">
              Exemplo numérico: financiamento de R$ 1.000.000 em 360 meses (10% a.a., TR 0,17% a.m.)
            </span>
          </div>
          <div className="px-6 py-2">
            <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b border-black/5 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Comparativo</span>
              <span className="text-right">PRICE</span>
              <span className="text-right">SAC</span>
            </div>
            {exampleRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-b border-black/5 px-2 py-3.5 text-sm last:border-0"
              >
                <span className="pr-2 text-muted-foreground">{row.label}</span>
                <span className="text-right font-medium tabular-nums">{row.price}</span>
                <span className="text-right font-semibold tabular-nums text-[#820AD1]">
                  {row.sac}
                </span>
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
