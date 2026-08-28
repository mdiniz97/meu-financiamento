'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';

export function AppHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/nova-simulacao" className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-lg font-bold text-[#820AD1]">Raio X</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            do Financiamento
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/portabilidade"
            className="text-sm font-medium text-foreground transition-colors hover:text-[#820AD1]"
          >
            Portabilidade
          </Link>
          <Link
            href="/planos"
            className="text-sm font-medium text-foreground transition-colors hover:text-[#820AD1]"
          >
            Planos
          </Link>
          <Link
            href="/minhas-simulacoes"
            className="text-sm font-medium text-foreground transition-colors hover:text-[#820AD1]"
          >
            Minhas simulações
          </Link>
          {signedIn ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sair
            </Button>
          ) : (
            <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
              Entrar
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
