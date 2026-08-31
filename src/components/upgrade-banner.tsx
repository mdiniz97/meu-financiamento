'use client';

import { useEffect, useState } from 'react';
import { ZapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/upgrade-dialog';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

export function UpgradeBanner({
  isUnlimited,
  expiresAt = null,
  sticky = false,
}: {
  isUnlimited?: boolean;
  expiresAt?: number | null;
  sticky?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isUnlimited) return null;
  const remaining = expiresAt === null ? null : formatRemaining(expiresAt - now);

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4',
        sticky && 'sticky top-2 z-10'
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-semibold">
          Plano Ilimitado: simulações sem limites, PDF e amortizador inteligente
        </p>
        <p className="text-xs text-muted-foreground">
          {remaining === null
            ? 'R$ 119,90/ano, cancele quando quiser.'
            : `Suas simulações expiram em ${remaining}. Assine e elas ficam salvas enquanto você for assinante.`}
        </p>
      </div>
      <Button type="button" onClick={() => setUpgradeOpen(true)} className="shrink-0">
        <ZapIcon className="size-4" />
        Assinar Ilimitado – R$ 119,90/ano
      </Button>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
