'use client';

import { useState } from 'react';
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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-[#820AD1]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border p-4">
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
  );
}

export function AppSidebar({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-base font-semibold tracking-tight">
              Raio X
              <span className="block font-normal text-muted-foreground">do Financiamento</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-1 flex-col justify-between p-3">
          <NavLinks />
          <SidebarFooter credits={credits} isUnlimited={isUnlimited} />
        </div>
      </aside>

      <MobileSidebar credits={credits} isUnlimited={isUnlimited} />
    </>
  );
}

function MobileSidebar({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
      </Link>
      <Button type="button" variant="ghost" size="sm" aria-label="Abrir menu" onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-2.5">
                <Logo size={28} />
                <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
              </span>
              <Button type="button" variant="ghost" size="sm" aria-label="Fechar menu" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex flex-1 flex-col justify-between p-3">
              <NavLinks onNavigate={() => setOpen(false)} />
              <SidebarFooter credits={credits} isUnlimited={isUnlimited} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
