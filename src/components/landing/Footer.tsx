import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#820AD1] text-white">
            <Logo size={18} />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Raio X do Financiamento
          </span>
        </Link>
        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Entrar
          </Link>
          <Link href="/cadastro" className="hover:text-foreground">
            Criar conta
          </Link>
        </div>
      </div>
      <p className="border-t border-black/5 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Raio X do Financiamento: ferramenta de
        simulação e educação financeira. Não substitui aconselhamento financeiro
        profissional.
      </p>
    </footer>
  );
}
