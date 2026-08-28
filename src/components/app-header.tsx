'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export function AppHeader({
  signedIn,
  credits,
  isUnlimited,
}: {
  signedIn: boolean;
  credits: number;
  isUnlimited: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-lg font-bold text-[#820AD1]">Raio X</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            do Financiamento
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          {signedIn && (
            <span className="hidden text-xs font-medium text-muted-foreground md:inline">
              {isUnlimited ? 'Plano Ilimitado' : `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`}
            </span>
          )}
          <Link
            href="/nova-simulacao"
            className="text-sm font-medium text-foreground transition-colors hover:text-[#820AD1]"
          >
            Simulações
          </Link>
          <Link
            href="/portabilidade"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-[#820AD1] sm:inline"
          >
            Portabilidade
          </Link>
          <Link
            href="/planos"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-[#820AD1] sm:inline"
          >
            Planos
          </Link>
          <Link
            href="/minhas-simulacoes"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-[#820AD1] sm:inline"
          >
            Minhas simulações
          </Link>
          <Link
            href="/perfil"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-[#820AD1] sm:inline"
          >
            Meu perfil
          </Link>
          <ThemeToggle />
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
