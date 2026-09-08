'use client';

import { useState } from 'react';
import { Plus, Lock } from 'lucide-react';
import type { LoanInput, SimulationResult } from '@/lib/finance/types';
import { priceBreakEven, recurringParcela, sacVsPrice } from '@/lib/finance/insights';
import { formatBRL } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  input: LoanInput;
  result: SimulationResult;
  isUnlimited: boolean;
  /** aplica o aporte necessário adicionando uma linha de amortização (visível e removível) */
  onApplyAporte?: (ratio: number) => void;
}

export function DebtInsightCard({ input, result, isUnlimited, onApplyAporte }: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  if (!isUnlimited) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="size-4 text-primary" /> Raio X da dívida
          </CardTitle>
          <CardDescription>
            Descubra a parcela mínima que abate sua dívida e o prazo ideal de financiamento.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setUpgradeOpen(true)}
            >
              <Lock className="size-3" /> Recurso exclusivo: ver opções de acesso
            </Button>
          </CardDescription>
        </CardHeader>
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </Card>
    );
  }

  if (input.system === 'SAC') {
    const c = sacVsPrice(input);
    const sacMaisCara = c.parcela1Sac > c.parcela1Price;
    const firstBalance = result.installments[0]?.saldo;
    const firstChange = firstBalance === undefined ? null : firstBalance - input.principal;
    const firstDescription = firstChange === null
      ? 'não tem saldo observado no mês 1'
      : firstChange < 0
        ? 'cai no mês 1'
        : firstChange > 0
          ? 'cresce no mês 1'
          : 'fica estável no mês 1';
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Raio X da dívida</CardTitle>
          <CardDescription>
            No cenário atual, a dívida {firstDescription}. A TR pode superar a amortização mesmo no SAC.
            Comparação abaixo: contratos sem estratégias.
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
              <span className="text-xs text-muted-foreground">Última parcela no SAC sem estratégias</span>
              <span className="text-lg font-semibold">{formatBRL(c.ultimaParcelaSac)}</span>
              <span className="text-xs text-muted-foreground">
                {c.ultimaParcelaSac < c.parcela1Sac
                  ? `${formatBRL(c.parcela1Sac - c.ultimaParcelaSac)} abaixo da primeira parcela`
                  : c.ultimaParcelaSac > c.parcela1Sac
                    ? `${formatBRL(c.ultimaParcelaSac - c.parcela1Sac)} acima da primeira parcela`
                    : 'igual à primeira parcela'}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground">Parcela SAC fica menor que a PRICE no mês</span>
              <span className="text-lg font-semibold">
                {c.crossingMonth ? `${c.crossingMonth} (${(c.crossingMonth / 12).toFixed(1)} anos)` : 'nunca'}
              </span>
              <span className="text-xs text-muted-foreground">
                primeiro cruzamento observado nos contratos sem estratégias; não garante as parcelas seguintes
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3">
              <span className="text-xs text-muted-foreground">Economia total do SAC vs PRICE</span>
              <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(c.economiaVsPrice)}</span>
              <span className="text-xs text-muted-foreground">
                {c.dividaCai12mSac === 0
                  ? 'dívida estável em 12 meses, sem estratégias'
                  : `dívida ${c.dividaCai12mSac > 0 ? 'cai' : 'cresce'} ${formatBRL(Math.abs(c.dividaCai12mSac))} em 12 meses, sem estratégias`}
              </span>
            </div>
          </div>
          <p className="rounded-xl bg-muted/50 p-3 text-muted-foreground">
            Sua dívida <strong>{firstDescription}</strong>
            {firstChange !== null && firstChange !== 0 ? ` em ${formatBRL(Math.abs(firstChange))}` : ''}.
            Esse resultado considera os aportes do cenário atual. Taxas, TR e janelas de aporte
            determinam os meses seguintes; uma queda inicial não garante queda contínua. Use o seletor
            &quot;Comparar PRICE ↔ SAC&quot; no topo para ver lado a lado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const be = priceBreakEven(input, result);
  const parcelaAtual = recurringParcela(result);
  const abateDesdeInicio = be.monthsUntilAmortize === 1;
  const parcelaCobre = parcelaAtual >= be.minPayment;
  const prazoOk = input.months <= be.maxMonths;
  const aporteAplicavel = Number.isFinite(be.requiredTotalExtraPct) && be.requiredTotalExtraPct <= 1;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Raio X da dívida</CardTitle>
        <CardDescription>No PRICE, juros + correção podem crescer mais que a amortização.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela recorrente no mês 1</span>
            <span className={`text-lg font-semibold ${parcelaCobre ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {formatBRL(parcelaAtual)}
            </span>
            <span className="text-xs text-muted-foreground">
              {parcelaCobre
                ? 'cobre juros e TR do saldo inicial'
                : `limiar aproximado no mês 1: ${formatBRL(be.minPayment)}`}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Primeira queda observada da dívida</span>
            <span className="text-lg font-semibold">
              {be.monthsUntilAmortize === null ? 'Não observada' : `mês ${be.monthsUntilAmortize}`}
              {abateDesdeInicio && ' ✓'}
            </span>
            <span className="text-xs text-muted-foreground">
              {abateDesdeInicio ? 'na primeira parcela deste cenário' : 'no cronograma simulado, incluindo aportes'}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Prazo estimado para queda no mês 1</span>
            <span className={`text-lg font-semibold ${prazoOk ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
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
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 dark:bg-[#820AD1]/15 p-3">
              <span className="text-xs text-muted-foreground">Parcela estimada no prazo de referência</span>
              <span className="text-lg font-semibold text-primary">{formatBRL(be.idealPayment)}</span>
              <span className="text-xs text-muted-foreground">
                {`com ${be.maxMonths} meses (${(be.maxMonths / 12).toFixed(1)} anos), sem estratégias`}
              </span>
            </div>
          )}
          {be.requiredExtraMonthly > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 dark:bg-[#820AD1]/15 p-3">
              <span className="text-xs text-muted-foreground">Aporte estimado para cobertura no mês 1</span>
              <span className="text-lg font-semibold text-primary">
                {formatBRL(be.requiredExtraMonthly)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  (+{(be.requiredTotalExtraPct * 100).toFixed(1)}% total da parcela)
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {aporteAplicavel
                  ? 'percentual aplicado desde o mês 1; revise a cobertura quando outras janelas terminarem'
                  : 'aporte acima de 100%; reduza o prazo ou revise as condições do financiamento'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit"
                onClick={() => onApplyAporte?.(be.requiredTotalExtraPct)}
                disabled={!aporteAplicavel}
              >
                <Plus className="size-3.5" /> Aplicar aporte
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Limiar aproximado de equilíbrio no mês 1: juros e TR sobre o saldo inicial, mais seguro.
          Para reduzir o saldo, o pagamento deve superar esse valor. Taxas, TR e seguro informados
          são mantidos na estimativa; aportes pontuais e mudanças nas janelas podem alterar os meses seguintes.
        </p>
        {!abateDesdeInicio && (
          <p className="rounded-xl bg-amber-50 dark:bg-amber-950/60 p-3 text-amber-800 dark:text-amber-300">
            O cronograma atual não registra queda do saldo no mês 1.
            {be.requiredExtraMonthly > 0 && <> A estimativa de aporte adicional nesse mês é de{' '}
              <strong>{formatBRL(be.requiredExtraMonthly)}</strong>.</>}
            {' '}Confira a tabela após aplicar o aporte: a estimativa inicial não garante queda contínua.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
