'use client';

import { Link } from 'lucide-react';
import type { LoanInput, SimulationResult } from '@/lib/finance/types';
import { priceBreakEven } from '@/lib/finance/insights';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  input: LoanInput;
  result: SimulationResult;
  isUnlimited: boolean;
}

export function DebtInsightCard({ input, result, isUnlimited }: Props) {
  if (!isUnlimited) {
    return (
      <Card className="rounded-2xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Raio X da dívida
            <Badge variant="secondary" className="text-xs">
              Exclusivo Ilimitado
            </Badge>
          </CardTitle>
          <CardDescription>
            Descubra a parcela mínima que abate sua dívida e o prazo ideal de financiamento.
            <a href="/planos" className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
              <Link className="size-3" /> Ver planos
            </a>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (input.system === 'SAC') {
    return (
      <Card className="rounded-2xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Raio X da dívida</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            No sistema <strong>SAC</strong> a amortização é fixa desde a 1ª parcela — sua dívida
            abate <strong>todo mês</strong>, sem depender de estratégias.
          </p>
        </CardContent>
      </Card>
    );
  }

  const be = priceBreakEven(input, result);
  const parcelaAtual = result.installments[0]?.parcela ?? 0;
  const abateDesdeInicio = (be.monthsUntilAmortize ?? 1) <= 1;
  const parcelaCobre = parcelaAtual >= be.minPayment;
  const prazoOk = input.months <= be.maxMonths;

  return (
    <Card className="rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Raio X da dívida</CardTitle>
        <CardDescription>No PRICE, juros + correção podem crescer mais que a amortização.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Sua parcela</span>
            <span className={`text-lg font-semibold ${parcelaCobre ? 'text-emerald-600' : 'text-destructive'}`}>
              {formatBRL(parcelaAtual)}
            </span>
            <span className="text-xs text-muted-foreground">
              {parcelaCobre
                ? 'cobre o crescimento da dívida'
                : `mínima para abater: ${formatBRL(be.minPayment)}`}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Dívida começa a cair no mês</span>
            <span className="text-lg font-semibold">
              {abateDesdeInicio ? '1' : `${be.monthsUntilAmortize}`}
              {abateDesdeInicio && ' ✓'}
            </span>
            <span className="text-xs text-muted-foreground">
              {abateDesdeInicio ? 'desde a primeira parcela' : `dos ${input.months} meses do contrato`}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Prazo ideal para abater desde o início</span>
            <span className={`text-lg font-semibold ${prazoOk ? 'text-emerald-600' : ''}`}>
              {Number.isFinite(be.maxMonths) ? `até ${be.maxMonths} meses` : 'sem limite'}
              {prazoOk && ' ✓'}
            </span>
            <span className="text-xs text-muted-foreground">
              {prazoOk
                ? 'seu prazo está ok'
                : `seu prazo é ${input.months} meses (${(input.months / 12).toFixed(1)} anos)`}
            </span>
          </div>
        </div>
        {!abateDesdeInicio && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-800">
            Sua parcela de <strong>{formatBRL(parcelaAtual)}</strong> não abate a dívida no começo —
            por {formatBRL(be.minPayment - parcelaAtual)} de parcela a mais (ou um prazo até{' '}
            {be.maxMonths} meses), a dívida cai desde a 1ª parcela e os juros totais despencam.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
