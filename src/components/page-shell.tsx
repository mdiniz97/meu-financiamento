import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Container padrão das páginas autenticadas em (app).
 *
 * O filho interno é `flex w-full max-w-5xl flex-col gap-6`, então os `children`
 * são empilhados na vertical com espaçamento de 24px. Passe os blocos da página
 * (PageHeader, cards, componentes clientes) como filhos diretos.
 */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className={cn('flex w-full max-w-5xl flex-col gap-6', className)}>{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon,
  badge,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display flex items-center gap-2 text-xl font-semibold">
          {icon}
          {title}
          {badge}
        </h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
