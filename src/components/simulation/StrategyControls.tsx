'use client';

import { useMemo, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { recurringParcela } from '@/lib/finance/insights';
import { simulate } from '@/lib/finance/engine';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  input: LoanInput;
  strategies: Strategies;
  onChange: (s: Strategies) => void;
  base: SimulationResult;
  current: SimulationResult;
  /** registra função que adiciona um aporte % extra (usado pelo 'Aplicar aporte' do Raio X) */
  onApplyAporteReady?: (fn: (pct: number) => void) => void;
}


type AporteTipo = 'pontual' | 'mensal' | 'pct' | 'recorrente' | 'anual' | 'sac';

const TIPO_LABELS: Record<AporteTipo, string> = {
  pontual: 'Pontual',
  mensal: 'Mensal (total fixo)',
  pct: '% extra mensal',
  recorrente: 'Recorrente',
  anual: 'Anual (FGTS)',
  sac: 'Pagar como no SAC',
};

const MODO_LABELS = { auto: 'Automático', term: 'Reduzir prazo', payment: 'Reduzir parcela' };

interface AporteRow {
  id: number;
  tipo: AporteTipo;
  amount: number;
  month: number;
  every: number;
  untilMonth?: number;
  mode?: 'term' | 'payment';
}

let aporteSeq = Math.floor(Math.random() * 1e9);

function deriveRows(strategies: Strategies): AporteRow[] {
  const rows: AporteRow[] = strategies.extraLumpSum.map((l) => ({
    id: ++aporteSeq,
    tipo: 'pontual' as const,
    amount: l.amount,
    month: l.month,
    every: 12,
    mode: l.reduceMode,
  }));
  if (strategies.extraMonthlyPct && strategies.extraMonthlyPct > 0) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'pct',
      amount: Math.round(strategies.extraMonthlyPct * 100),
      month: strategies.extraMonthlyPctStartMonth ?? 1,
      every: 12,
      untilMonth: strategies.extraMonthlyPctUntilMonth,
      mode: strategies.extraMonthlyPctReduceMode,
    });
  }
  if (strategies.fixedPayment) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'mensal',
      amount: strategies.fixedPayment.amount,
      month: strategies.fixedPayment.startMonth ?? 1,
      every: 1,
      untilMonth: strategies.fixedPayment.untilMonth,
      mode: strategies.fixedPayment.reduceMode,
    });
  }
  if (strategies.recurringExtra) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'recorrente',
      amount: strategies.recurringExtra.amount,
      month: strategies.recurringExtra.startMonth,
      every: strategies.recurringExtra.every,
      untilMonth: strategies.recurringExtra.untilMonth,
      mode: strategies.recurringExtra.reduceMode,
    });
  }
  if (strategies.paySacParcela) {
    rows.push({ id: ++aporteSeq, tipo: 'sac', amount: 0, month: 1, every: 12 });
  }
  if (strategies.fgtsAnnual) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'anual',
      amount: strategies.fgtsAnnual.amount,
      month: strategies.fgtsAnnual.startMonth ?? 12,
      every: 12,
      untilMonth: strategies.fgtsAnnual.untilMonth,
      mode: strategies.fgtsAnnual.reduceMode,
    });
  }
  return rows;
}

function rowPick(r: AporteRow): Partial<Strategies> {
  if (r.tipo === 'pontual' && r.amount > 0 && r.month >= 1) {
    return { extraLumpSum: [{ month: r.month, amount: r.amount, ...(r.mode ? { reduceMode: r.mode } : {}) }] };
  }
  if (r.tipo === 'pct' && r.amount > 0) {
    return {
      extraMonthlyPct: r.amount / 100,
      ...(r.month >= 1 ? { extraMonthlyPctStartMonth: r.month } : {}),
      ...(r.untilMonth ? { extraMonthlyPctUntilMonth: r.untilMonth } : {}),
      ...(r.mode ? { extraMonthlyPctReduceMode: r.mode } : {}),
    };
  }
  if (r.tipo === 'mensal' && r.amount > 0) {
    return {
      fixedPayment: {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  if (r.tipo === 'recorrente' && r.amount > 0) {
    return {
      recurringExtra: {
        amount: r.amount,
        every: Math.max(1, r.every),
        startMonth: Math.max(1, r.month),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  if (r.tipo === 'sac') {
    return { paySacParcela: true };
  }
  if (r.tipo === 'anual' && r.amount > 0) {
    return {
      fgtsAnnual: {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  return {};
}

function rowsToStrategies(rows: AporteRow[]): Pick<Strategies, 'extraLumpSum' | 'extraMonthlyPct' | 'extraMonthlyPctStartMonth' | 'extraMonthlyPctUntilMonth' | 'fixedPayment' | 'recurringExtra' | 'fgtsAnnual' | 'paySacParcela'> {
  const pctRow = rows.find((r) => r.tipo === 'pct' && r.amount > 0);
  return {
    extraLumpSum: rows
      .filter((r) => r.tipo === 'pontual' && r.amount > 0 && r.month >= 1)
      .map((r) => ({ month: r.month, amount: r.amount, ...(r.mode ? { reduceMode: r.mode } : {}) })),
    extraMonthlyPct: pctRow ? pctRow.amount / 100 : undefined,
    ...(pctRow && pctRow.month >= 1 ? { extraMonthlyPctStartMonth: pctRow.month } : {}),
    ...(pctRow && pctRow.untilMonth ? { extraMonthlyPctUntilMonth: pctRow.untilMonth } : {}),
    ...(pctRow && pctRow.mode ? { extraMonthlyPctReduceMode: pctRow.mode } : {}),
    fixedPayment: (() => {
      const r = rows.find((x) => x.tipo === 'mensal' && x.amount > 0);
      if (!r) return undefined;
      return {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
    recurringExtra: (() => {
      const r = rows.find((x) => x.tipo === 'recorrente' && x.amount > 0);
      if (!r) return undefined;
      return {
        amount: r.amount,
        every: Math.max(1, r.every),
        startMonth: Math.max(1, r.month),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
    paySacParcela: rows.some((x) => x.tipo === 'sac'),
    fgtsAnnual: (() => {
      const r = rows.find((x) => x.tipo === 'anual' && x.amount > 0);
      if (!r) return undefined;
      return {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
  };
}

export function StrategyControls({ input, strategies, onChange, base, current, onApplyAporteReady }: Props) {
  const [rows, setRows] = useState<AporteRow[]>(() => deriveRows(strategies));

  // diferença real entre os modos para cada linha (só mostra o seletor quando há)
  const rowsInfo = useMemo(
    () =>
      rows.map((r) => {
        const baseRow = { extraLumpSum: [], reduceMode: 'term' as const };
        const t = simulate(input, { ...baseRow, ...rowPick(r), reduceMode: 'term' });
        const p = simulate(input, { ...baseRow, ...rowPick(r), reduceMode: 'payment' });
        return {
          differs:
            Math.abs(t.metrics.totalPago - p.metrics.totalPago) > 1 ||
            t.metrics.saldoZeroAt !== p.metrics.saldoZeroAt,
          termTotal: t.metrics.totalPago,
          payTotal: p.metrics.totalPago,
        };
      }),
    [input, rows]
  );

  const updateRows = (next: AporteRow[]) => {
    setRows(next);
    onChange({ ...strategies, ...rowsToStrategies(next) });
  };

  if (onApplyAporteReady) {
    onApplyAporteReady((pct: number) => {
      const pctArredondado = Math.round(pct * 100) / 100;
      updateRows([...rows, { id: ++aporteSeq, tipo: 'pct', amount: pctArredondado, month: 1, every: 12 }]);
    });
  }

  const economia = base.metrics.totalPago - current.metrics.totalPago;
  const parcelaBase = recurringParcela(base);
  const parcelaAtual = recurringParcela(current);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-4">
    <Card className="rounded-2xl shadow-sm lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Estratégias</CardTitle>
        <CardDescription>
          Combine aportes pontuais e mensais, com período opcional, e veja os resultados ao vivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Amortizações</h3>
          <p className="text-xs text-muted-foreground">
            Pontuais (uma vez no mês X), recorrentes (a cada X meses) ou anuais (FGTS). Cada uma com
            início e fim opcionais.
          </p>
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma amortização definida.</p>
          )}
          {rows.map((r, ri) => (
            <div key={r.id} className="flex flex-wrap items-end gap-2">
              <div className="flex w-32 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={r.tipo}
                  onValueChange={(v) =>
                    updateRows(rows.map((x) => (x.id === r.id ? { ...x, tipo: v as AporteTipo } : x)))
                  }
                >
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue>{TIPO_LABELS[r.tipo]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pontual">Pontual</SelectItem>
                    <SelectItem value="mensal">Mensal (total fixo)</SelectItem>
                    <SelectItem value="pct">% extra mensal</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                    <SelectItem value="anual">Anual (FGTS)</SelectItem>
                    {input.system === 'PRICE' && (
                      <SelectItem value="sac">Pagar como no SAC</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {r.tipo === 'sac' ? (
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    Paga no PRICE o valor que pagaria no SAC: a diferença vira amortização extra.
                  </p>
                </div>
              ) : (
              <div className="flex w-28 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {r.tipo === 'pct' ? 'Percentual (%)' : 'Valor (R$)'}
                </Label>
                <NumericInput
                  maxLength={r.tipo === 'pct' ? 3 : 10}
                  value={r.amount > 0 ? r.amount : undefined}
                  parse={r.tipo === 'pct' ? parseDecimal : parseBRLToNumber}
                  onValid={(v) =>
                    updateRows(rows.map((x) => (x.id === r.id ? { ...x, amount: Math.max(0, v) } : x)))
                  }
                />
              </div>
              )}
              {r.tipo !== 'sac' && (
              <div className="flex w-24 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`apMonth${r.id}`}>
                  {r.tipo === 'anual'
                    ? 'no mês'
                    : r.tipo === 'recorrente' || r.tipo === 'mensal' || r.tipo === 'pct'
                      ? 'do mês'
                      : 'mês'}
                </Label>
                <NumericInput
                  id={`apMonth${r.id}`}
                  maxLength={4}
                  value={r.month}
                  parse={parseIntStrict}
                  onValid={(v) =>
                    updateRows(rows.map((x) => (x.id === r.id ? { ...x, month: Math.max(1, v) } : x)))
                  }
                />
              </div>
              )}
              {r.tipo === 'recorrente' && (
                <div className="flex w-20 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground" htmlFor={`apEvery${r.id}`}>
                    a cada
                  </Label>
                  <NumericInput
                    id={`apEvery${r.id}`}
                    maxLength={3}
                    value={r.every}
                    parse={parseIntStrict}
                    onValid={(v) =>
                      updateRows(rows.map((x) => (x.id === r.id ? { ...x, every: Math.max(1, v) } : x)))
                    }
                  />
                </div>
              )}
              {r.tipo !== 'sac' && (
              <div className="flex w-24 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`apUntil${r.id}`}>
                  até o mês (opcional)
                </Label>
                <NumericInput
                  id={`apUntil${r.id}`}
                  maxLength={4}
                  value={r.untilMonth}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) =>
                    updateRows(
                      rows.map((x) => (x.id === r.id ? { ...x, untilMonth: v > 0 ? v : undefined } : x))
                    )
                  }
                />
              </div>
              )}
              {r.tipo !== 'sac' && rowsInfo[ri]?.differs && (
                <div className="flex w-32 flex-col gap-1.5">
                  <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                    Modo
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-3 cursor-help" aria-label="Explicação do modo" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-60 text-xs">
                          <p><strong>Reduzir prazo:</strong> mantém a parcela e quita antes (economiza mais).</p>
                          <p className="mt-1"><strong>Reduzir parcela:</strong> mantém o prazo e diminui a parcela (alivia o fluxo de caixa).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select
                    value={r.mode ?? 'auto'}
                    onValueChange={(v) =>
                      updateRows(
                        rows.map((x) =>
                          x.id === r.id
                            ? { ...x, mode: v === 'auto' ? undefined : (v as 'term' | 'payment') }
                            : x
                        )
                      )
                    }
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue>{MODO_LABELS[r.mode ?? 'auto']}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="term">Reduzir prazo</SelectItem>
                      <SelectItem value="payment">Reduzir parcela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                aria-label="Remover"
                onClick={() => updateRows(rows.filter((x) => x.id !== r.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateRows([...rows, { id: ++aporteSeq, tipo: 'pontual', amount: 0, month: 1, every: 12 }])
              }
            >
              <Plus className="size-4" /> Adicionar amortização
            </Button>
          </div>
        </section>

        {input.system === 'PRICE' && (
          <>
            <Separator />
            <section className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={strategies.paySacParcela === true}
                  onCheckedChange={(checked) => onChange({ ...strategies, paySacParcela: checked })}
                />
                Pagar como no SAC
              </Label>
              <p className="text-xs text-muted-foreground">
                Paga no PRICE o valor que pagaria no SAC: a diferença vira amortização extra.
              </p>
            </section>
          </>
        )}

      </CardContent>
    </Card>

    <Card className="rounded-2xl shadow-sm lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 dark:bg-zinc-800/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela atual</span>
            <span className="text-lg font-semibold">{formatBRL(parcelaBase)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 dark:bg-zinc-800/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela nova</span>
            <span className="text-lg font-semibold text-primary">{formatBRL(parcelaAtual)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 dark:bg-zinc-800/50 p-3">
            <span className="text-xs text-muted-foreground">Juros totais</span>
            <span className="text-lg font-semibold">{formatBRL(current.metrics.totalJuros)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 dark:bg-zinc-800/50 p-3">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {current.metrics.saldoZeroAt} meses
              <span className="text-xs font-normal text-muted-foreground">
                {' '}({(current.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
        </section>
        <div
          className={`flex flex-col gap-1 rounded-2xl p-4 shadow-sm ${
            economia >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60' : 'bg-destructive/10 dark:bg-destructive/20'
          }`}
        >
          <span className="text-xs text-muted-foreground">
            {economia >= 0 ? 'Economia total' : 'Custo adicional'}
          </span>
          <span
            className={`text-lg font-semibold ${economia >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {economia >= 0 ? formatBRL(economia) : `-${formatBRL(-economia)}`}
          </span>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}