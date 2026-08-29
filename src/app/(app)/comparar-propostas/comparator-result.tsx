'use client';

import { ArrowRight, Download, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { CompareChart } from '@/components/simulation/charts/CompareChart';
import { formatBRL } from '@/lib/utils';
import type { ComparatorInput, ComparatorProposal } from '@/lib/comparator/types';
import type { ComparatorResult, ProposalOutcome } from '@/lib/comparator/calculate';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

function levarAoSimulador(p: ComparatorProposal) {
  const form = {
    system: p.system,
    principal: String(Math.round(p.principal)),
    annualRate: String((p.annualRate * 100).toFixed(2)),
    months: String(p.months),
    trMonthly: String((p.trMonthly * 100).toFixed(2)),
    insuranceMonthly: String(Math.round(p.insuranceMonthly)),
    bank: p.bank,
    lumpSum: [],
    extraMonthlyPct: '0',
    extraMonthlyPctStart: '',
    extraMonthlyPctUntil: '',
    fixedPaymentStart: '',
    fgtsAnnual: '0',
    fgtsStartMonth: '12',
    fgtsUntilMonth: '',
    recurringExtra: null,
    fixedPayment: '',
    fixedPaymentUntil: '',
    paySacParcela: false,
    reduceMode: 'term',
    portability: null,
  };
  sessionStorage.setItem('sim-input', JSON.stringify(form));
  window.location.href = '/simulacao?name=comparador';
}

export function ComparatorResultView({
  result,
  input,
  onSave,
}: {
  result: ComparatorResult;
  input: ComparatorInput;
  onSave: () => void;
}) {
  const { ranked, best, smartRanked, outcomes } = result.v1;
  if (!best) return null;
  const saldos = (o: ProposalOutcome) => o.result.installments.map((i) => i.saldo);
  const smartSaldos = (o: ProposalOutcome) => o.smart?.recommended.best?.result.installments.map((i) => i.saldo) ?? [];
  const alerts = outcomes.filter((o) => o.cetAlert);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Melhor proposta: {best.proposal.bank} ({best.proposal.system})
          {best.proposal.name && <span className="text-sm font-normal text-muted-foreground">· {best.proposal.name}</span>}
          <Badge variant="secondary">#1</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
            <span className="text-xs text-muted-foreground">Custo total da aquisição</span>
            <span className="text-lg font-semibold text-primary">{formatBRL(best.acquisitionCost)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">Economia vs 2ª</span>
            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(Math.max(0, ranked[1]?.acquisitionCost - best.acquisitionCost))}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">Custo / R$ 100 mil financiados</span>
            <span className="text-lg font-semibold">{formatBRL(best.costPer100k)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">Parcela inicial</span>
            <span className="text-lg font-semibold">{formatBRL(best.result.installments[0]?.parcela ?? 0)}</span>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="border-b border-border py-2 pr-2">Proposta</th>
                <th className="border-b border-border py-2 pr-2 text-right">Custo aquisição</th>
                <th className="border-b border-border py-2 pr-2 text-right">Custo financiamento</th>
                <th className="border-b border-border py-2 pr-2 text-right">/R$ 100 mil</th>
                <th className="border-b border-border py-2 pr-2 text-right">Parcela 1</th>
                <th className="border-b border-border py-2 pr-2 text-right">Quita em</th>
                <th className="border-b border-border py-2 pr-2 text-right">CET informado</th>
                <th className="border-b border-border py-2 pr-2 text-right">CET calculado</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((o, i) => (
                <tr key={o.proposal.id} className={o.proposal.id === best.proposal.id ? 'font-semibold' : ''}>
                  <td className="py-2 pr-2">
                    {i + 1}º · {o.proposal.bank} ({o.proposal.system})
                  </td>
                  <td className="py-2 pr-2 text-right">{formatBRL(o.acquisitionCost)}</td>
                  <td className="py-2 pr-2 text-right">{formatBRL(o.financingCost)}</td>
                  <td className="py-2 pr-2 text-right">{formatBRL(o.costPer100k)}</td>
                  <td className="py-2 pr-2 text-right">{formatBRL(o.result.installments[0]?.parcela ?? 0)}</td>
                  <td className="py-2 pr-2 text-right">{o.result.metrics.saldoZeroAt} m</td>
                  <td className="py-2 pr-2 text-right">{pct(o.proposal.cetInformed)}</td>
                  <td className={`py-2 pr-2 text-right ${o.cetAlert ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                    {pct(o.cetCalculated)}
                    {o.cetAlert && ' ⚠'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {alerts.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Alerta de CET: os dados informados não reproduzem o CET anunciado nas propostas{' '}
            {alerts.map((o) => o.proposal.bank).join(', ')}. Revise taxas, seguros e tarifas.
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <BalanceChart data={best.result.installments.map((i) => ({ month: i.month, saldo: i.saldo }))} />
          <div className="flex flex-col gap-3">
            <CompareChart
              base={saldos(ranked[0])}
              withStrategy={smartSaldos(ranked[0])}
              baseName={`${ranked[0].proposal.bank} original`}
              strategyName="Amortizador inteligente"
            />
            {smartRanked.map((o) => (
              <p key={o.proposal.id} className="text-xs text-muted-foreground">
                {o.proposal.bank}:{' '}
                {o.smart?.feasible
                  ? `quita em ${o.smart.recommended.best?.result.metrics.saldoZeroAt ?? '—'} meses com aporte de ${formatBRL(o.smart.recommended.best?.extraMonthlyAmount ?? 0)}/mês`
                  : `orçamento mínimo de ${formatBRL(o.smart?.minBudget ?? 0)}/mês para caber no amortizador`}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave}>
            <Save className="size-4" /> Salvar comparação
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              window.location.assign(
                `/api/pdf/comparison?${new URLSearchParams({
                  proposals: JSON.stringify(input.proposals),
                  monthlyBudget: String(input.monthlyBudget),
                })}`
              )
            }
          >
            <Download className="size-4" /> Gerar PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => levarAoSimulador(best.proposal)}>
            Levar ao simulador <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
