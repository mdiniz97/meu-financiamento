'use client';

import { useRouter } from 'next/navigation';
import type { SimulationResult } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BalanceChart } from './charts/BalanceChart';
import { InstallmentTable } from './InstallmentTable';

interface Props {
  keep: SimulationResult;
  ported: SimulationResult;
  keepTitle: string;
  portedTitle: string;
  prefill?: { principal: string; annualRate: string; months: string };
}

function ScenarioCard({ title, result, accent }: { title: string; result: SimulationResult; accent: boolean }) {
  return (
    <Card className={`rounded-2xl shadow-sm ${accent ? 'ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : ''}`}>
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
              <span className="block text-xs font-normal text-muted-foreground">
                ({(result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
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
        <InstallmentTable installments={result.installments} height="h-[360px]" showAporte={false} minimal />
      </CardContent>
    </Card>
  );
}

export function PortabilitySandbox({ keep, ported, keepTitle, portedTitle, prefill }: Props) {
  const router = useRouter();
  const vantajoso = keep.metrics.totalPago - ported.metrics.totalPago > 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {vantajoso ? (
          <>
            Portar reduz o total pago em{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatBRL(keep.metrics.totalPago - ported.metrics.totalPago)}
            </strong>
          </>
        ) : (
          <>
            Manter no banco atual é{' '}
            <strong className="text-destructive">
              {formatBRL(ported.metrics.totalPago - keep.metrics.totalPago)}
            </strong>{' '}
            mais barato que portar
          </>
        )}
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ScenarioCard title={keepTitle} result={keep} accent={!vantajoso} />
        <div className="flex flex-col gap-3">
          <ScenarioCard title={portedTitle} result={ported} accent={vantajoso} />
          {prefill && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                router.push(
                  `/nova-simulacao?principal=${encodeURIComponent(prefill.principal)}&taxa=${encodeURIComponent(prefill.annualRate)}&prazo=${encodeURIComponent(prefill.months)}`
                )
              }
            >
              Levar para o simulador
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
