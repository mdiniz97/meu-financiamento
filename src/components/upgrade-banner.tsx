'use client';

import { useState } from 'react';
import { ZapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/upgrade-dialog';

export function UpgradeBanner({
  isUnlimited,
  sticky = false,
}: {
  isUnlimited?: boolean;
  sticky?: boolean;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isUnlimited) return null;

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
          R$ 119,90/ano, cancele quando quiser.
        </p>
      </div>
      <Button type="button" onClick={() => setUpgradeOpen(true)} className="shrink-0">
        <ZapIcon className="size-4" />
        Assinar Ilimitado, R$ 119,90/ano
      </Button>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
