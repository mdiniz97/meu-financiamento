'use client';

import { useRouter } from 'next/navigation';
import type { SimulationResult, LoanInput } from '@/lib/finance/types';
import {
  DEFAULT_FORM,
  SIM_INPUT_KEY,
  type FormState,
} from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BalanceChart } from './charts/BalanceChart';
import { InstallmentTable } from './InstallmentTable';

interface Props {
  keep: SimulationResult;
  ported: SimulationResult;
  keepTitle: string;
  portedTitle: string;
  costs: number;
  economiaLiquida: number;
  disabled?: boolean;
}

function inputToPrefill(input: LoanInput): FormState {
  return {
    ...DEFAULT_FORM,
    system: input.system,
    principal: numberToBRLInput(input.principal),
    annualRate: String(input.annualRate * 100),
    annualRateKind: 'effective-annual',
    trMonthly: String(Number((input.trMonthly * 100).toPrecision(15))),
    insuranceMonthly: numberToBRLInput(input.insuranceMonthly),
    months: String(input.months),
    bank: input.bank,
  };
}

function ScenarioCard({
  title,
  result,
  accent,
  costs = 0,
}: {
  title: string;
  result: SimulationResult;
  accent: boolean;
  costs?: number;
}) {
  return (
    <Card
      role="region"
      aria-label={title}
      className={`min-w-0 overflow-hidden rounded-2xl border border-muted-foreground/40 shadow-sm [overflow-wrap:anywhere] ${accent ? 'ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : ''}`}
    >
      <CardHeader>
        <CardTitle className={`text-lg ${accent ? 'text-[#820AD1]' : ''}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 overflow-hidden">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
            <span className="text-xs text-muted-foreground">Parcela 1</span>
            <span className="text-lg font-semibold">{formatBRL(result.installments[0]?.parcela ?? 0)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {result.metrics.saldoZeroAt} meses
              <span className="block text-xs font-normal text-muted-foreground">
                ({(result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold">{formatBRL(result.metrics.totalPago + costs)}</span>
            {costs > 0 && (
              <span className="text-xs text-muted-foreground">inclui {formatBRL(costs)} de custos</span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted/50 p-3 [overflow-wrap:anywhere]">
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

export function PortabilitySandbox({
  keep,
  ported,
  keepTitle,
  portedTitle,
  costs,
  economiaLiquida,
  disabled,
}: Props) {
  const router = useRouter();
  const outcome = economiaLiquida > 0 ? 'positive' : economiaLiquida < 0 ? 'negative' : 'neutral';

  function levarAoSandbox(input: LoanInput) {
    sessionStorage.setItem(SIM_INPUT_KEY, JSON.stringify(inputToPrefill(input)));
    router.push('/simulacao');
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {outcome === 'positive' ? (
          <>
            Portar reduz o total pago em{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {formatBRL(economiaLiquida)}
            </strong>
          </>
        ) : outcome === 'negative' ? (
          <>
            Manter no banco atual é{' '}
            <strong className="text-destructive">
              {formatBRL(-economiaLiquida)}
            </strong>{' '}
            mais barato que portar
          </>
        ) : (
          <>Empate: manter e portar têm o mesmo custo total.</>
        )}
      </p>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <ScenarioCard title={keepTitle} result={keep} accent={outcome === 'negative'} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled}
            aria-label="Levar cenário atual para o simulador"
            onClick={() => levarAoSandbox(keep.input)}
          >
            Levar para o simulador
          </Button>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <ScenarioCard title={portedTitle} result={ported} accent={outcome === 'positive'} costs={costs} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled}
            aria-label="Levar proposta para o simulador"
            onClick={() => levarAoSandbox(ported.input)}
          >
            Levar para o simulador
          </Button>
        </div>
      </div>
    </div>
  );
}
