import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size={32} className="sm:hidden" />
          <Logo size={36} variant="full" className="hidden sm:block" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/custos-da-compra"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden px-4 text-sm sm:inline-flex"
            )}
          >
            Quanto preciso para comprar?
          </Link>
          <Link
            href="/juros"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden px-4 text-sm sm:inline-flex"
            )}
          >
            Juros de mercado
          </Link>
          <Link
            href="/blog"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden px-4 text-sm sm:inline-flex"
            )}
          >
            Blog
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/minhas-simulacoes"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "hidden px-4 text-sm sm:inline-flex"
                )}
              >
                Minhas simulações
              </Link>
              <Link
                href="/nova-simulacao"
                className={cn(buttonVariants({ variant: "default" }), "px-5 text-sm")}
              >
                Ir para o simulador
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "hidden px-4 text-sm sm:inline-flex"
                )}
              >
                Fazer login
              </Link>
              <Link
                href="/cadastro"
                className={cn(buttonVariants({ variant: "default" }), "px-5 text-sm")}
              >
                Criar conta grátis
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
