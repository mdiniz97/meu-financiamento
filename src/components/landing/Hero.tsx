import Link from "next/link";
import { ArrowRightIcon, CheckIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { simulate } from "@/lib/finance/engine";
import type { LoanInput } from "@/lib/finance/types";

const trustPoints = ["Grátis para começar", "Sem cartão de crédito", "2 créditos de boas-vindas"];

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

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#820AD1]/10 to-transparent"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#820AD1]/20 bg-white px-4 py-1.5 text-sm font-medium text-[#820AD1] shadow-sm">
          <ZapIcon className="size-4" />
          2 créditos de boas-vindas
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
          Veja o raio X do seu financiamento{" "}
          <span className="text-[#820AD1]">antes de assinar o contrato</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Compare os sistemas SAC e PRICE, descubra quanto você realmente paga de
          juros e escolha a estratégia que economiza milhares de reais no seu
          financiamento imobiliário.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-12 rounded-full px-8 text-base"
            )}
          >
            Criar conta grátis
            <ArrowRightIcon className="size-4" />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12 rounded-full bg-white px-8 text-base"
            )}
          >
            Fazer login
          </Link>
        </div>
        <ul className="mt-8 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          {trustPoints.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <CheckIcon className="size-4 text-[#820AD1]" />
              {point}
            </li>
          ))}
        </ul>

        <div className="mt-14 w-full max-w-4xl rounded-3xl bg-white p-6 shadow-lg shadow-[#820AD1]/5 ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold">
                Exemplo real: R$ 1 milhão em 360 meses (10% a.a., TR 0,17%)
              </span>
            </div>
            <span className="text-xs text-muted-foreground">calculado pelo nosso motor</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-2xl bg-[#F5F5F5] p-4 text-left">
              <span className="text-xs text-muted-foreground">Parcela inicial</span>
              <span className="text-lg font-semibold tabular-nums">
                {brl(price.installments[0].parcela)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">PRICE</span>
              </span>
              <span className="text-lg font-semibold tabular-nums text-[#820AD1]">
                {brl(sac.installments[0].parcela)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">SAC</span>
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-[#F5F5F5] p-4 text-left">
              <span className="text-xs text-muted-foreground">Amortização na 1ª parcela</span>
              <span className="text-lg font-semibold tabular-nums">
                {brl(price.installments[0].amortizacao)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">PRICE</span>
              </span>
              <span className="text-lg font-semibold tabular-nums text-[#820AD1]">
                {brl(sac.installments[0].amortizacao)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">SAC</span>
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-[#F5F5F5] p-4 text-left">
              <span className="text-xs text-muted-foreground">Juros totais em 30 anos</span>
              <span className="text-lg font-semibold tabular-nums">{brl(price.metrics.totalJuros)}</span>
              <span className="text-lg font-semibold tabular-nums text-[#820AD1]">
                {brl(sac.metrics.totalJuros)}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-[#F5F5F5] p-4 text-left">
              <span className="text-xs text-muted-foreground">Diferença no total pago</span>
              <span className="text-lg font-semibold tabular-nums text-emerald-600">
                {brl(price.metrics.totalJuros - sac.metrics.totalJuros)}
              </span>
              <span className="text-xs text-muted-foreground">
                de economia escolhendo certo
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
