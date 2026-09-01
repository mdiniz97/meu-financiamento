import Link from "next/link";
import { Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function ObraExplain({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <span className="flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/[0.04] px-3 py-1 text-xs font-semibold text-[#820AD1]">
              <Hammer className="size-3.5" /> Comprar na planta
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Como funciona comprar na planta?
            </h2>
            <p className="text-lg text-muted-foreground">
              Quem compra na planta não paga a parcela cheia durante a construção: paga{" "}
              <strong className="text-foreground">juros de obra</strong> sobre o valor que o
              banco já liberou, mais o <strong className="text-foreground">seguro de obra</strong>,
              até a entrega.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Juros de obra:</strong> só os juros, sem
                amortizar o saldo, enquanto a obra é construída.
              </li>
              <li>
                <strong className="text-foreground">Seguro de obra:</strong> cobertura
                obrigatória da construção, cobrada todo mês.
              </li>
              <li>
                <strong className="text-foreground">Depois da entrega:</strong> o saldo começa
                a ser amortizado e a parcela vira a cheia.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Exemplo: imóvel de R$ 500 mil com 20% de entrada, 10,5% a.a. e obra de 24 meses
              soma cerca de R$ 42 mil em juros e seguro antes da entrega. Simule o seu caso,
              inclusive se a obra já está em andamento.
            </p>
            <Link
              href={signedIn ? "/comprar-na-planta" : "/cadastro"}
              className={cn(buttonVariants({ variant: "default" }), "w-fit items-center gap-2")}
            >
              <Hammer className="size-4" />
              Calcular meus juros de obra
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Imóvel na planta</span>
                <span className="font-semibold">R$ 500.000,00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Entrada (20%)</span>
                <span className="font-semibold">R$ 100.000,00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Financiado</span>
                <span className="font-semibold">R$ 400.000,00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Obra até a entrega</span>
                <span className="font-semibold">24 meses</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Juros de obra estimados</span>
                <span className="font-semibold text-[#820AD1]">~R$ 41.800</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Seguro de obra (R$ 50/mês)</span>
                <span className="font-semibold">R$ 1.200,00</span>
              </div>
              <div className="mt-2 rounded-xl bg-muted/50 p-3">
                <span className="block text-xs text-muted-foreground">
                  Primeira parcela após entrega (PRICE 360m)
                </span>
                <span className="text-xl font-bold font-mono tabular-nums">R$ 3.518/mês</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
