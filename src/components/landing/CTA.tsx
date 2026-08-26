import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-[#820AD1] px-6 py-16 text-center text-white sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-white/10"
        />
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
            <SparklesIcon className="size-4" />
            2 créditos de boas-vindas — sem cartão de crédito
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para enxergar o que está por trás das parcelas?
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Crie sua conta grátis e veja o raio X do seu financiamento em menos
            de 2 minutos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/cadastro"
              className={cn(
                buttonVariants({ variant: "default" }),
                "h-12 rounded-full bg-white px-8 text-base text-[#820AD1] hover:bg-white/90"
              )}
            >
              Criar conta grátis
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-12 rounded-full px-8 text-base text-white hover:bg-white/15 hover:text-white"
              )}
            >
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
