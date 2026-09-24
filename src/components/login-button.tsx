'use client';

import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLoginDialog } from './login-dialog-provider';

interface LoginButtonProps extends VariantProps<typeof buttonVariants> {
  label: string;
  className?: string;
  /** Caminho pretendido após o login. */
  next?: string;
}

/**
 * Gatilho do modal de login. Sem `variant`, renderiza um botão cru — para
 * lugares que usam estilo de link (ex.: o rodapé).
 */
export function LoginButton({ label, className, next, variant, size }: LoginButtonProps) {
  const { openLogin } = useLoginDialog();

  return (
    <button
      type="button"
      onClick={() => openLogin(next)}
      className={cn(variant ? buttonVariants({ variant, size }) : undefined, className)}
    >
      {label}
    </button>
  );
}
