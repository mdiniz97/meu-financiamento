'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { useAuthDialog } from '@/components/auth-dialog-provider';
import { signedInNavItem } from '@/lib/landing/signed-in-nav';

const publicLinks = [
  { href: '/custos-da-compra', label: 'Quanto preciso para comprar?' },
  { href: '/juros', label: 'Juros de mercado' },
  { href: '/blog', label: 'Blog' },
];

export function MobilePublicNav({ signedIn, unlimited = false }: { signedIn: boolean; unlimited?: boolean }) {
  const navItem = signedInNavItem(unlimited);
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const { openLogin, openSignup } = useAuthDialog();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 768px)');
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="md:hidden"
        aria-label="Abrir menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex md:hidden" role="dialog" aria-label="Menu de navegação" aria-modal="true">
          <button type="button" aria-label="Fechar ao clicar fora" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-sm flex-col bg-background shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Link href="/" onClick={() => setOpen(false)} aria-label="Página inicial">
                <Logo size={32} variant="full" />
              </Link>
              <Button ref={closeButton} type="button" variant="ghost" size="sm" aria-label="Fechar menu" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <nav aria-label="Links do menu" className="flex flex-col gap-1 overflow-y-auto p-4">
              {publicLinks.map(({ href, label }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="px-4 py-3 text-sm font-medium hover:bg-muted">
                  {label}
                </Link>
              ))}
              {signedIn ? (
                <>
                  <Link href="/nova-simulacao" onClick={() => setOpen(false)} className="px-4 py-3 text-sm font-medium hover:bg-muted">Ir para o simulador</Link>
                  <Link href={navItem.href} onClick={() => setOpen(false)} className="px-4 py-3 text-sm font-medium hover:bg-muted">{navItem.label}</Link>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setOpen(false); openLogin(); }} className="px-4 py-3 text-left text-sm font-medium hover:bg-muted">Fazer login</button>
                  <button type="button" onClick={() => { setOpen(false); openSignup(); }} className="px-4 py-3 text-left text-sm font-medium hover:bg-muted">Criar conta grátis</button>
                </>
              )}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
