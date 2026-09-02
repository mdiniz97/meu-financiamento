'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/upgrade-dialog';

export function ExclusiveCard({
  isUnlimited,
  benefit,
}: {
  isUnlimited: boolean;
  benefit: string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isUnlimited) return null;

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-muted/50 p-6 text-center sm:p-10">
      <div className="flex size-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
        <Lock className="size-7 text-[#820AD1]" />
      </div>
      <p className="text-sm font-semibold">Recurso exclusivo do plano Ilimitado</p>
      <p className="max-w-md text-sm text-muted-foreground">{benefit}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={() => setUpgradeOpen(true)}
      >
        <Lock className="size-3" /> Ver opções de acesso
      </Button>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
