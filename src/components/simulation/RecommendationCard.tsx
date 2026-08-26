'use client';

import type { SimulationResult } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Props {
  base: SimulationResult;
  best: SimulationResult;
}

export function RecommendationCard({ base, best }: Props) {
  const economy = Math.max(0, base.metrics.totalPago - best.metrics.totalPago);
  const monthsSaved = Math.max(0, base.metrics.saldoZeroAt - best.metrics.saldoZeroAt);
  const yearsSaved = monthsSaved / 12;
  const hasGain = economy > 0;

  return (
    <div className="rounded-2xl border-2 border-[#820AD1] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className="bg-[#820AD1]">Melhor caminho</Badge>
        <span className="text-xs text-muted-foreground">
          Sistema {best.system}
          {hasGain ? ' · com estratégias aplicadas' : ' · sem estratégias aplicadas'}
        </span>
      </div>

      {hasGain ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold">{formatBRL(best.metrics.totalPago)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Economia total</span>
            <span className="text-lg font-semibold text-[#820AD1]">
              {formatBRL(economy)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Tempo a menos</span>
            <span className="text-lg font-semibold">
              {yearsSaved.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} anos
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Sem estratégia aplicada, o cenário atual já é o mais econômico.
          </span>
          <span className="text-lg font-semibold">{formatBRL(best.metrics.totalPago)}</span>
        </div>
      )}
    </div>
  );
}
