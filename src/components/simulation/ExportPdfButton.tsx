'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { SimulationResult } from '@/lib/finance/types';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UpgradeDialog } from '@/components/upgrade-dialog';

export function ExportPdfButton({
  result,
  isUnlimited,
}: {
  result: SimulationResult;
  isUnlimited: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!isUnlimited) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Exportar PDF (exclusivo do plano Ilimitado)"
                  onClick={() => setUpgradeOpen(true)}
                />
              }
            >
              Exportar PDF <Lock className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Exclusivo do plano Ilimitado</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </>
    );
  }

  function handleExport() {
    setDownloading(true);
    const full = { ...result, installments: result.installments.slice(0, 360) };
    const encoded = encodeURIComponent(JSON.stringify(full));
    const payload =
      encoded.length <= 12000
        ? encoded
        : encodeURIComponent(JSON.stringify({ input: result.input, strategies: result.strategies }));
    window.open('/api/pdf?result=' + payload, '_blank');
    setTimeout(() => setDownloading(false), 1500);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={downloading}>
      {downloading ? 'Gerando…' : 'Exportar PDF'}
    </Button>
  );
}
