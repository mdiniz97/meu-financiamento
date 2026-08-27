'use client';

import type { SimulationResult } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BalanceChart } from './charts/BalanceChart';
import { InstallmentTable } from './InstallmentTable';

interface Props {
  keep: SimulationResult;
  ported: SimulationResult;
  keepTitle: string;
  portedTitle: string;
}

function ScenarioCard({ title, result, accent }: { title: string; result: SimulationResult; accent: boolean }) {
  return (
    <Card className={`rounded-2xl shadow-sm ${accent ? 'bg-white ring-2 ring-[#820AD1]' : 'bg-white'}`}>
      <CardHeader>
        <CardTitle className={`text-lg ${accent ? 'text-[#820AD1]' : ''}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela 1</span>
            <span className="text-lg font-semibold">{formatBRL(result.installments[0]?.parcela ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {result.metrics.saldoZeroAt} meses
              <span className="text-xs font-normal text-muted-foreground">
                {' '}({(result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold">{formatBRL(result.metrics.totalPago)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Juros totais</span>
            <span className="text-lg font-semibold">{formatBRL(result.metrics.totalJuros)}</span>
          </div>
        </div>
        <BalanceChart data={result.installments.map((i) => ({ month: i.month, saldo: i.saldo }))} />
        <InstallmentTable installments={result.installments} height="h-[300px]" />
      </CardContent>
    </Card>
  );
}

export function PortabilitySandbox({ keep, ported, keepTitle, portedTitle }: Props) {
  const vantajoso = keep.metrics.totalPago - ported.metrics.totalPago > 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Comparação lado a lado:{' '}
        {vantajoso ? (
          <>
            <strong className="text-emerald-600">portar economiza {formatBRL(keep.metrics.totalPago - ported.metrics.totalPago)}</strong> no
            total
          </>
        ) : (
          <>
            <strong className="text-destructive">manter é {formatBRL(ported.metrics.totalPago - keep.metrics.totalPago)} mais barato</strong>
          </>
        )}
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ScenarioCard title={keepTitle} result={keep} accent={!vantajoso} />
        <ScenarioCard title={portedTitle} result={ported} accent={vantajoso} />
      </div>
    </div>
  );
}
