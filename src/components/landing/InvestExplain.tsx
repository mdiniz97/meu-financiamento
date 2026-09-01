import Link from "next/link";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function InvestExplain({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.04] px-3 py-1 text-xs font-semibold text-[#820AD1]">
            <Scale className="size-3.5" /> Investir ou amortizar
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Com R$ 100 mil, vale investir ou amortizar?
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Amortizar é um retorno <strong className="text-foreground">garantido</strong> da
            taxa do seu contrato. Investir na Selic rende a taxa de hoje{" "}
            <strong className="text-foreground">menos o Imposto de Renda</strong>. A resposta
            depende do seu financiamento e do horizonte.
          </p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">Exemplo: financiamento de 12% a.a.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Com a Selic em 14% a.a., R$ 100 mil investidos por 10 anos rendem cerca de{" "}
                <strong className="text-foreground">R$ 230 mil líquidos</strong>, mais que os
                ~R$ 210 mil que a amortização economizaria.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">Exemplo: financiamento de 15% a.a.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Com a Selic em 10% a.a., a amortização economiza{" "}
                <strong className="text-foreground">mais que o investimento</strong>, e sem
                depender da Selic futura.
              </p>
            </div>
          </div>
          <Link
            href={signedIn ? "/investir-ou-amortizar" : "/cadastro"}
            className={cn(buttonVariants({ variant: "default" }), "mt-6 items-center gap-2")}
          >
            <Scale className="size-4" />
            Comparar meu caso
          </Link>
        </div>
      </div>
    </section>
  );
}
