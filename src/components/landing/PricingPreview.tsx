import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const starterFeatures = [
  "10 simulações completas",
  "Comparação SAC × PRICE",
  "Simulação de estratégias de amortização",
];

const unlimitedFeatures = [
  "Simulações ilimitadas",
  "Comparação SAC × PRICE ao vivo",
  "Exportação do Raio X em PDF",
  "Estratégias com FGTS, amortização extra e portabilidade",
];

export function PricingPreview() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Planos simples, preços honestos
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Comece grátis com 2 créditos de boas-vindas e evolua quando precisar.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-5 rounded-2xl bg-white p-7 shadow-sm">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">R$ 10</span>
            <span className="text-sm font-medium text-muted-foreground">
              por 10 créditos
            </span>
          </div>
          <p className="text-sm font-semibold">Para tirar dúvidas pontuais</p>
          <ul className="flex flex-col gap-2.5">
            {starterFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#820AD1]" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-auto h-11 rounded-full bg-white text-base"
            )}
          >
            Criar conta grátis
          </Link>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl bg-white p-7 shadow-sm ring-2 ring-[#820AD1]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">R$ 99,90</span>
              <span className="text-sm font-medium text-muted-foreground">/mês</span>
            </div>
            <span className="rounded-full bg-[#820AD1] px-3 py-1 text-xs font-semibold text-white">
              Melhor para quem vai financiar
            </span>
          </div>
          <p className="text-sm font-semibold">Plano Ilimitado, sem limites</p>
          <ul className="flex flex-col gap-2.5">
            {unlimitedFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#820AD1]" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ variant: "default" }),
              "mt-auto h-11 rounded-full text-base"
            )}
          >
            Criar conta grátis
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Cancele quando quiser, sem multa. Preços em reais (BRL).
      </p>
    </section>
  );
}
