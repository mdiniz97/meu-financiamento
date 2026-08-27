import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-base font-semibold tracking-tight">
            Raio X
            <span className="font-normal text-muted-foreground"> do Financiamento</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
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
        </nav>
      </div>
    </header>
  );
}
