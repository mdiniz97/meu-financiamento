import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginButton } from "@/components/login-button";
import { SITE_NAME } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={32} variant="full" />
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/juros" className="hover:text-foreground">
            Juros de mercado
          </Link>
          <Link href="/custos-da-compra" className="hover:text-foreground">
            Quanto preciso para comprar?
          </Link>
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
          <LoginButton label="Entrar" className="hover:text-foreground" />
          <Link href="/cadastro" className="hover:text-foreground">
            Criar conta
          </Link>
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE_NAME}: ferramenta de
        simulação e educação financeira. Não substitui aconselhamento financeiro
        profissional.
      </p>
    </footer>
  );
}
