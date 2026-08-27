'use client';

import { Link, Plus } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { priceBreakEven, recurringParcela, sacVsPrice } from '@/lib/finance/insights';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  input: LoanInput;
  result: SimulationResult;
  strategies: Strategies;
  isUnlimited: boolean;
  onChange: (s: Strategies) => void;
}

export function DebtInsightCard({ input, result, strategies, isUnlimited, onChange }: Props) {
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
    const c = sacVsPrice(input);
    const sacMaisCara = c.parcela1Sac > c.parcela1Price;
    return (
      <Card className="rounded-2xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Raio X da dívida</CardTitle>
          <CardDescription>
            No SAC a amortização é fixa desde a 1ª parcela: a dívida abate todo mês. Compare com o PRICE:
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Parcela 1 no SAC</span>
              <span className="text-lg font-semibold">{formatBRL(c.parcela1Sac)}</span>
              <span className="text-xs text-muted-foreground">
                {sacMaisCara
                  ? `começa ${formatBRL(c.parcela1Sac - c.parcela1Price)} acima da PRICE`
                  : 'já menor que a PRICE'}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Parcela mínima (última) no SAC</span>
              <span className="text-lg font-semibold">{formatBRL(c.ultimaParcelaSac)}</span>
              <span className="text-xs text-muted-foreground">
                cai {formatBRL(c.parcela1Sac - c.ultimaParcelaSac)} até o fim
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Parcela SAC fica menor que a PRICE no mês</span>
              <span className="text-lg font-semibold">
                {c.crossingMonth ? `${c.crossingMonth} (${(c.crossingMonth / 12).toFixed(1)} anos)` : 'nunca'}
              </span>
              <span className="text-xs text-muted-foreground">
                depois disso, o SAC paga menos que a PRICE em todas as parcelas
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 p-3">
              <span className="text-xs text-muted-foreground">Economia total do SAC vs PRICE</span>
              <span className="text-lg font-semibold text-emerald-600">{formatBRL(c.economiaVsPrice)}</span>
              <span className="text-xs text-muted-foreground">
                dívida cai {formatBRL(c.dividaCai12mSac)} em 12 meses
              </span>
            </div>
          </div>
          <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
            No SAC sua dívida <strong>cai desde o mês 1</strong>: diferentemente do PRICE, onde pode
            crescer no início. O preço é a parcela inicial mais alta
            {sacMaisCara ? ` (${formatBRL(c.parcela1Sac - c.parcela1Price)} a mais)` : ''}; depois do mês{' '}
            {c.crossingMonth ?? '·'} ela fica menor que a PRICE para sempre. Use o seletor
            &quot;Comparar PRICE ↔ SAC&quot; no topo para ver lado a lado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const be = priceBreakEven(input, result);
  const parcelaAtual = recurringParcela(result);
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
          {be.idealPayment !== null && (
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
              <span className="text-xs text-muted-foreground">Parcela se financiar já no prazo ideal</span>
              <span className="text-lg font-semibold text-primary">{formatBRL(be.idealPayment)}</span>
              <span className="text-xs text-muted-foreground">
                {prazoOk
                  ? 'mesma parcela, dívida caindo desde o início'
                  : `com ${be.maxMonths} meses (${(be.maxMonths / 12).toFixed(1)} anos)`}
              </span>
            </div>
          )}
          {be.requiredExtraMonthly > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
              <span className="text-xs text-muted-foreground">Aporte mensal p/ abater no seu prazo</span>
              <span className="text-lg font-semibold text-primary">
                {formatBRL(be.requiredExtraMonthly)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  (+{(be.requiredExtraPct * 100).toFixed(1)}% da parcela)
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                amortize por fora todo mês e a dívida cai desde a 1ª parcela
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={() => {
                  const pctAtual = strategies.extraMonthlyPct ?? 0;
                  onChange({
                    ...strategies,
                    extraMonthlyPct: Math.min(1, pctAtual + be.requiredExtraPct),
                  });
                }}
              >
                <Plus className="size-3.5" /> Aplicar aporte
              </Button>
            </div>
          )}
        </div>
        {!abateDesdeInicio && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-800">
            Sua parcela de <strong>{formatBRL(parcelaAtual)}</strong> não abate a dívida no começo.
            por <strong>{formatBRL(be.requiredExtraMonthly)}/mês</strong> de aporte por fora, ou
            financiando em até {be.maxMonths} meses com parcela de{' '}
            <strong>{formatBRL(be.idealPayment ?? parcelaAtual)}</strong>, a dívida cai desde a 1ª
            parcela e os juros totais despencam.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
