import Link from "next/link";
import { ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#820AD1] text-white">
            <ZapIcon className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Raio X
            <span className="font-normal text-muted-foreground"> do Financiamento</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden rounded-full px-4 text-sm sm:inline-flex"
            )}
          >
            Fazer login
          </Link>
          <Link
            href="/cadastro"
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-full px-5 text-sm"
            )}
          >
            Criar conta grátis
          </Link>
        </nav>
      </div>
    </header>
  );
}
