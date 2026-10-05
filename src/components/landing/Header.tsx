import Link from "next/link";
import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/auth-button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobilePublicNav } from "@/components/landing/mobile-public-nav";
import { signedInNavItem } from "@/lib/landing/signed-in-nav";

export function Header({ signedIn = false, unlimited = false }: { signedIn?: boolean; unlimited?: boolean }) {
  const navItem = signedInNavItem(unlimited);
  const link = "hidden px-2 text-sm md:inline-flex";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size={32} className="md:hidden" />
          <Logo size={36} variant="full" className="hidden md:block" />
        </Link>
        <nav className="flex items-center gap-0.5">
          <Link href="/custos-da-compra" className={cn(buttonVariants({ variant: "ghost" }), link)}>
            Custos da compra
          </Link>
          <Link href="/juros" className={cn(buttonVariants({ variant: "ghost" }), link)}>
            Juros
          </Link>
          <Link href="/negociacao" className={cn(buttonVariants({ variant: "ghost" }), link)}>
            Negociação
          </Link>
          <Link href="/blog" className={cn(buttonVariants({ variant: "ghost" }), link)}>
            Blog
          </Link>
          {signedIn ? (
            <>
              <Link href={navItem.href} className={cn(buttonVariants({ variant: "ghost" }), link)}>
                {navItem.label}
              </Link>
              <Link href="/nova-simulacao" className={cn(buttonVariants({ variant: "default" }), "px-5 text-sm")}>
                Ir para o simulador
              </Link>
            </>
          ) : (
            <>
              <AuthButton
                mode="login"
                variant="ghost"
                label="Fazer login"
                className="hidden px-2 text-sm lg:inline-flex"
              />
              <AuthButton
                mode="signup"
                variant="default"
                label="Criar conta grátis"
                className="hidden px-3 text-sm sm:inline-flex"
              />
            </>
          )}
          <ThemeToggle />
          <MobilePublicNav signedIn={signedIn} unlimited={unlimited} />
        </nav>
      </div>
    </header>
  );
}
