import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { HoverScale } from "@/components/landing/motion-primitives";

export function CTA({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div className="border border-foreground bg-foreground px-6 py-16 text-center text-background sm:px-12">
        <div className="mx-auto max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-widest text-background/70">
            <span className="font-mono">2</span> créditos de boas-vindas · sem cartão de crédito
          </span>
          <h2 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para enxergar o que está por trás das parcelas?
          </h2>
          <p className="mt-4 text-lg text-background/80">
            Crie sua conta grátis e veja o raio X do seu financiamento em menos
            de 2 minutos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <HoverScale>
              <Link
                href={signedIn ? "/nova-simulacao" : "/cadastro"}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-12 border border-background bg-background px-8 text-base text-foreground hover:bg-background/90"
                )}
              >
                {signedIn ? "Ir para o simulador" : "Criar conta grátis"}
                <ArrowRightIcon className="size-4" />
              </Link>
            </HoverScale>
            <AuthButton
              mode="login"
              variant="ghost"
              label="Fazer login"
              className="h-12 border border-background/30 px-8 text-base text-background hover:bg-background/10 hover:text-background"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
