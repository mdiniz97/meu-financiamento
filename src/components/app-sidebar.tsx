'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ArrowLeftRight, Calculator, History, Menu, Scale, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/nova-simulacao', label: 'Simulações', icon: Calculator },
  { href: '/portabilidade', label: 'Portabilidade', icon: ArrowLeftRight },
  { href: '/comparar-propostas', label: 'Comparar propostas', icon: Scale },
  { href: '/minhas-simulacoes', label: 'Minhas simulações', icon: History },
  { href: '/perfil', label: 'Meu perfil', icon: User },
];

export function AppSidebar({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
        </Link>
        <Button type="button" variant="ghost" size="sm" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
            </span>
            <Button type="button" variant="ghost" size="sm" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            <nav className="flex flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-[#820AD1]'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
            <span className="rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              {isUnlimited ? 'Plano Ilimitado' : `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`}
            </span>
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" className="flex-1" onClick={() => signOut()}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
