import Link from "next/link";
import { Logo } from "@/components/logo";
import { AuthButton } from "@/components/auth-button";
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
          <Link href="/termos" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookies
          </Link>
          <AuthButton mode="login" label="Entrar" className="hover:text-foreground" />
          <AuthButton mode="signup" label="Criar conta" className="hover:text-foreground" />
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
