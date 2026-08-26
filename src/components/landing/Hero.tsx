import Link from "next/link";
import { ArrowRightIcon, CheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const trustPoints = ["Grátis para começar", "Sem cartão de crédito", "2 créditos de boas-vindas"];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#820AD1]/10 to-transparent"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#820AD1]/20 bg-white px-4 py-1.5 text-sm font-medium text-[#820AD1] shadow-sm">
          <SparklesIcon className="size-4" />
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
      </div>
    </section>
  );
}
