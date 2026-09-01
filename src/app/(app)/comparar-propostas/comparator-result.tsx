'use client';

import { ArrowRight, Download, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { CompareChart } from '@/components/simulation/charts/CompareChart';
import { formatBRL } from '@/lib/utils';
import type { ComparatorInput } from '@/lib/comparator/types';
import type { ComparatorResult, ProposalOutcome } from '@/lib/comparator/calculate';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

function levarAoSimulador(o: ProposalOutcome) {
  const p = o.proposal;
  const best = o.smart?.feasible ? o.smart.recommended.best : null;
  const form = {
    system: best?.system ?? p.system,
    principal: String(Math.round(p.principal)),
    annualRate: String(p.annualRate * 100),
    annualRateKind: 'effective-annual',
    months: String(best?.months ?? p.months),
    trMonthly: String((p.trMonthly * 100).toFixed(2)),
    insuranceMonthly: String(Math.round(p.insuranceMonthly)),
    bank: p.bank,
    lumpSum: [],
    extraMonthlyPct: best ? String((best.extraMonthlyPct * 100).toFixed(2)) : '0',
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
  window.location.href = '/simulacao';
}

function modoSmart(o: ProposalOutcome): 'term' | 'payment' | null {
  const rec = o.smart?.recommended;
  const best = rec?.best;
  if (!rec || !best) return null;
  const total = best.result.metrics.totalPago;
  if (rec.modes.term?.result.metrics.totalPago === total) return 'term';
  if (rec.modes.payment?.result.metrics.totalPago === total) return 'payment';
  return null;
}

function SmartPlanCard({ o }: { o: ProposalOutcome }) {
  const best = o.smart?.recommended.best;
  if (!best) return null;
  const original = o.result;
  const economia = Math.max(0, original.metrics.totalPago - best.result.metrics.totalPago);
  const modo = modoSmart(o);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/50 p-4 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{o.proposal.bank}, amortizador inteligente</span>
        <Badge variant="secondary" className="text-[10px]">
          {best.system}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Prazo</span>
        <span className="text-right font-medium">
          {best.months} meses <span className="text-muted-foreground">(original: {o.proposal.months})</span>
        </span>
        <span className="text-muted-foreground">Parcela + aporte</span>
        <span className="text-right font-medium">
          {formatBRL(best.parcela)}
          {best.extraMonthlyAmount > 0 && (
            <span className="text-muted-foreground"> + {formatBRL(best.extraMonthlyAmount)}</span>
          )}
        </span>
        <span className="text-muted-foreground">Quitação</span>
        <span className="text-right font-medium">
          {best.result.metrics.saldoZeroAt} meses <span className="text-muted-foreground">(original: {original.metrics.saldoZeroAt})</span>
        </span>
        <span className="text-muted-foreground">Total pago</span>
        <span className="text-right font-medium">
          {formatBRL(best.result.metrics.totalPago)}
          <span className="text-muted-foreground"> → economiza {formatBRL(economia)}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {modo === 'payment' ? 'Estratégia: reduzir a parcela' : 'Estratégia: reduzir o prazo'}
        </span>
        <button
          type="button"
          onClick={() => levarAoSimulador(o)}
          className="flex items-center gap-1 font-medium text-[#820AD1] hover:underline"
        >
          Abrir no simulador <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
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
    <TooltipProvider>
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
              <Tooltip>
                <TooltipTrigger>
                  <span className="cursor-help text-lg font-semibold underline decoration-dotted underline-offset-4">
                    {formatBRL(best.costPer100k)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Custo do financiamento (parcelas + seguro + tarifas, sem a entrada) proporcional a cada
                  R$ 100 mil financiados, útil para comparar propostas com valores diferentes.
                </TooltipContent>
              </Tooltip>
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
                  <th className="border-b border-border py-2 pr-2 text-right">
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="cursor-help underline decoration-dotted underline-offset-4">CET calculado</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Taxa efetiva total que reproduz seu fluxo (crédito líquido − tarifas marcadas &quot;no CET&quot;) com as
                        parcelas. A ⚠ indica que os dados não reproduzem o CET anunciado pelo banco.
                      </TooltipContent>
                    </Tooltip>
                  </th>
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
                      {o.cetAlert && (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="cursor-help" aria-label="CET informado não bate com o calculado">
                              {' '}⚠
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            O CET informado ({pct(o.proposal.cetInformed)}) difere do calculado ({pct(o.cetCalculated)}).
                            Revise taxas, seguros e tarifas, ou o banco anunciou um CET que os números não reproduzem.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {alerts.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Alerta de CET: os dados informados não reproduzem o CET anunciado nas propostas{' '}
              {alerts.map((o) => o.proposal.bank).join(', ')}. Passe o mouse sobre o ⚠ para detalhes.
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
              <p className="text-xs text-muted-foreground">
                Plano do amortizador inteligente com orçamento de {formatBRL(input.monthlyBudget)}/mês:
              </p>
              <div className="flex flex-col gap-2">
                {smartRanked.map((o) => (
                  <SmartPlanCard key={o.proposal.id} o={o} />
                ))}
              </div>
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
            <Button type="button" variant="outline" onClick={() => levarAoSimulador(best)}>
              Levar ao simulador <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
