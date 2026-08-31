'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ArrowLeftRight, Calculator, History, Home, Menu, Percent, Scale, Sparkles, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/nova-simulacao', label: 'Simulações', icon: Calculator },
  { href: '/amortizador-inteligente', label: 'Amortizador Inteligente', icon: Sparkles },
  { href: '/juros', label: 'Juros de mercado', icon: Percent },
  { href: '/portabilidade', label: 'Portabilidade', icon: ArrowLeftRight },
  { href: '/comparar-propostas', label: 'Comparar propostas', icon: Scale },
  { href: '/qual-imovel-cabe-no-meu-bolso', label: 'Imóvel no meu bolso', icon: Home },
  { href: '/minhas-simulacoes', label: 'Minhas simulações', icon: History },
  { href: '/perfil', label: 'Meu perfil', icon: User },
];

function NavLinks({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
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
              'flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors',
              compact ? 'px-3 py-2' : 'rounded-xl px-4 py-3.5 text-base',
              active
                ? 'bg-primary/10 text-[#820AD1]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className={cn('shrink-0', compact ? 'size-4' : 'size-5')} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function PlanChip({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  return (
    <span className="rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
      {isUnlimited ? 'Plano Ilimitado' : `${credits} ${credits === 1 ? 'crédito' : 'créditos'}`}
    </span>
  );
}

function ActionsRow() {
  return (
    <div className="flex items-center justify-between gap-2">
      <ThemeToggle />
      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => signOut()}>
        Sair
      </Button>
    </div>
  );
}

function MobileDrawer({
  open,
  onClose,
  credits,
  isUnlimited,
}: {
  open: boolean;
  onClose: () => void;
  credits: number;
  isUnlimited: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex min-[1024px]:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col bg-background shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
          </span>
          <Button type="button" variant="ghost" size="sm" aria-label="Fechar menu" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <NavLinks onNavigate={onClose} />
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
          <PlanChip credits={credits} isUnlimited={isUnlimited} />
          <ActionsRow />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AppSidebar({ credits, isUnlimited }: { credits: number; isUnlimited: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background min-[1024px]:flex">
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
          <NavLinks compact />
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <PlanChip credits={credits} isUnlimited={isUnlimited} />
            <ActionsRow />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 min-[1024px]:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-base font-semibold tracking-tight">Raio X do Financiamento</span>
        </Link>
        <Button type="button" variant="ghost" size="sm" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </header>

      <MobileDrawer open={open} onClose={() => setOpen(false)} credits={credits} isUnlimited={isUnlimited} />
    </>
  );
}
