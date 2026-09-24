'use client';

import type { ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthDialog } from './auth-dialog-provider';
import type { AuthMode } from '@/lib/login-redirect';

interface AuthButtonProps extends VariantProps<typeof buttonVariants> {
  label: string;
  mode: AuthMode;
  className?: string;
  /** Caminho pretendido após autenticar. */
  next?: string;
  /** Conteúdo extra (ex.: um ícone) renderizado depois do rótulo. */
  children?: ReactNode;
}

/**
 * Gatilho do modal de autenticação. Sem `variant`, renderiza um botão cru —
 * para lugares que usam estilo de link (ex.: o rodapé).
 */
export function AuthButton({
  label,
  mode,
  className,
  next,
  variant,
  size,
  children,
}: AuthButtonProps) {
  const { openLogin, openSignup } = useAuthDialog();
  const open = mode === 'signup' ? openSignup : openLogin;

  return (
    <button
      type="button"
      onClick={() => open(next)}
      className={cn(variant ? buttonVariants({ variant, size }) : undefined, className)}
    >
      {label}
      {children}
    </button>
  );
}
