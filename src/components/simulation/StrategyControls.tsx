'use client';

import { useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { recurringParcela } from '@/lib/finance/insights';
import { convertAnnualToMonthly, pmt } from '@/lib/finance/engine';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  input: LoanInput;
  strategies: Strategies;
  onChange: (s: Strategies) => void;
  base: SimulationResult;
  current: SimulationResult;
}

const minimoQueAbate = (input: LoanInput) => {
  const m = convertAnnualToMonthly(input.annualRate);
  const mEff = (1 + m) * (1 + input.trMonthly) - 1;
  return input.system === 'PRICE'
    ? pmt(mEff, input.months, input.principal) + input.insuranceMonthly
    : pmt(input.trMonthly, input.months, input.principal) + input.principal * m + input.insuranceMonthly;
};

const MesCampo = ({ value, onValid, id, label }: { value?: number; onValid: (v: number) => void; id: string; label: string }) => (
  <div className="flex w-24 flex-col gap-1.5">
    <Label className="text-xs text-muted-foreground" htmlFor={id}>
      {label}
    </Label>
    <NumericInput
      id={id}
      maxLength={4}
      value={value}
      parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
      onValid={onValid}
    />
  </div>
);

type AporteTipo = 'pontual' | 'recorrente' | 'anual';

interface AporteRow {
  id: number;
  tipo: AporteTipo;
  amount: number;
  month: number;
  every: number;
  untilMonth?: number;
}

let aporteSeq = 0;

function deriveRows(strategies: Strategies): AporteRow[] {
  const rows: AporteRow[] = strategies.extraLumpSum.map((l) => ({
    id: ++aporteSeq,
    tipo: 'pontual' as const,
    amount: l.amount,
    month: l.month,
    every: 12,
  }));
  if (strategies.recurringExtra) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'recorrente',
      amount: strategies.recurringExtra.amount,
      month: strategies.recurringExtra.startMonth,
      every: strategies.recurringExtra.every,
      untilMonth: strategies.recurringExtra.untilMonth,
    });
  }
  if (strategies.fgtsAnnual) {
    rows.push({
      id: ++aporteSeq,
      tipo: 'anual',
      amount: strategies.fgtsAnnual.amount,
      month: strategies.fgtsAnnual.startMonth ?? 12,
      every: 12,
      untilMonth: strategies.fgtsAnnual.untilMonth,
    });
  }
  return rows;
}

function rowsToStrategies(rows: AporteRow[]): Pick<Strategies, 'extraLumpSum' | 'recurringExtra' | 'fgtsAnnual'> {
  return {
    extraLumpSum: rows
      .filter((r) => r.tipo === 'pontual' && r.amount > 0 && r.month >= 1)
      .map((r) => ({ month: r.month, amount: r.amount })),
    recurringExtra: (() => {
      const r = rows.find((x) => x.tipo === 'recorrente' && x.amount > 0);
      if (!r) return undefined;
      return {
        amount: r.amount,
        every: Math.max(1, r.every),
        startMonth: Math.max(1, r.month),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
      };
    })(),
    fgtsAnnual: (() => {
      const r = rows.find((x) => x.tipo === 'anual' && x.amount > 0);
      if (!r) return undefined;
      return {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
      };
    })(),
  };
}

export function StrategyControls({ input, strategies, onChange, base, current }: Props) {
  const pctExtra = Math.round((strategies.extraMonthlyPct ?? 0) * 100);
  const [rows, setRows] = useState<AporteRow[]>(() => deriveRows(strategies));

  const updateRows = (next: AporteRow[]) => {
    setRows(next);
    onChange({ ...strategies, ...rowsToStrategies(next) });
  };

  const economia = base.metrics.totalPago - current.metrics.totalPago;
  const parcelaBase = recurringParcela(base);
  const parcelaAtual = recurringParcela(current);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-4">
    <Card className="rounded-2xl bg-white shadow-sm lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Estratégias</CardTitle>
        <CardDescription>
          Combine aportes pontuais e mensais, com período opcional, e veja os resultados ao vivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Aporte mensal</h3>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extraMonthlyPct">% extra mensal ({pctExtra}%)</Label>
            <div className="flex items-end gap-3">
              <Slider
                className="flex-1"
                min={0}
                max={100}
                step={1}
                value={pctExtra}
                onValueChange={(v) => onChange({ ...strategies, extraMonthlyPct: Number(v) / 100 })}
              />
              <NumericInput
                id="extraMonthlyPct"
                className="w-14"
                maxLength={3}
                value={pctExtra}
                parse={parseDecimal}
                onValid={(v) => onChange({ ...strategies, extraMonthlyPct: Math.min(100, Math.max(0, v)) / 100 })}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <MesCampo
                id="pctStart"
                label="do mês"
                value={strategies.extraMonthlyPctStartMonth}
                onValid={(v) =>
                  onChange({ ...strategies, extraMonthlyPctStartMonth: v > 0 ? v : undefined })
                }
              />
              <MesCampo
                id="pctUntil"
                label="até o mês (opcional)"
                value={strategies.extraMonthlyPctUntilMonth}
                onValid={(v) =>
                  onChange({ ...strategies, extraMonthlyPctUntilMonth: v > 0 ? v : undefined })
                }
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="fixedPayment">Pagamento fixo: total por mês (R$)</Label>
              <MoneyInput
                id="fixedPayment"
                maxLength={10}
                value={strategies.fixedPayment?.amount ?? 0}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    fixedPayment:
                      v > 0
                        ? {
                            amount: v,
                            ...(strategies.fixedPayment?.startMonth
                              ? { startMonth: strategies.fixedPayment.startMonth }
                              : {}),
                            ...(strategies.fixedPayment?.untilMonth
                              ? { untilMonth: strategies.fixedPayment.untilMonth }
                              : {}),
                          }
                        : undefined,
                  })
                }
              />
            </div>
            <MesCampo
              id="fixedPaymentStart"
              label="do mês"
              value={strategies.fixedPayment?.startMonth}
              onValid={(v) =>
                onChange({
                  ...strategies,
                  fixedPayment: {
                    amount: strategies.fixedPayment?.amount ?? 0,
                    ...(v > 0 ? { startMonth: v } : {}),
                    ...(strategies.fixedPayment?.untilMonth
                      ? { untilMonth: strategies.fixedPayment.untilMonth }
                      : {}),
                  },
                })
              }
            />
            <MesCampo
              id="fixedPaymentUntil"
              label="até o mês (opcional)"
              value={strategies.fixedPayment?.untilMonth}
              onValid={(v) =>
                onChange({
                  ...strategies,
                  fixedPayment: {
                    amount: strategies.fixedPayment?.amount ?? 0,
                    ...(strategies.fixedPayment?.startMonth
                      ? { startMonth: strategies.fixedPayment.startMonth }
                      : {}),
                    ...(v > 0 ? { untilMonth: v } : {}),
                  },
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Com o aporte mensal, prefere
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="size-3.5 cursor-help text-muted-foreground" aria-label="Explicação" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-64 text-xs">
                    <p><strong>Reduzir parcela:</strong> o aporte abate a dívida e o prazo continua o mesmo: a parcela é recalculada para abater o saldo + correção. Se sua parcela atual não cobre juros + TR, o mínimo que abate pode ser maior que ela.</p>
                    <p className="mt-1"><strong>Reduzir prazo:</strong> o aporte abate a dívida e a parcela continua a mesma: o financiamento termina antes e você paga menos juros.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <RadioGroup
              value={strategies.reduceMode}
              onValueChange={(mode) => onChange({ ...strategies, reduceMode: mode as Strategies['reduceMode'] })}
              className="flex flex-row gap-4"
            >
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="payment" />
                Reduzir parcela
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="term" />
                Reduzir prazo
              </Label>
            </RadioGroup>
            {strategies.reduceMode === 'payment' && current.metrics.paymentApplied === false && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Aporte <strong>pontual</strong> não reduz a parcela mensal: o mínimo que ainda abate a
                dívida no seu prazo é de <strong>{formatBRL(minimoQueAbate(input))}/mês</strong>, acima
                da sua parcela atual ({formatBRL(parcelaAtual)}/mês). Por isso os dois modos dão o
                mesmo resultado. Para o modo &quot;reduzir parcela&quot; fazer efeito, use um aporte{' '}
                <strong>mensal</strong> (pagamento fixo, % extra ou FGTS).
              </p>
            )}
          </div>
        </section>

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
          {rows.map((r) => (
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pontual">Pontual</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                    <SelectItem value="anual">Anual (FGTS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-28 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <NumericInput
                  maxLength={10}
                  value={r.amount > 0 ? r.amount : undefined}
                  parse={parseBRLToNumber}
                  onValid={(v) =>
                    updateRows(rows.map((x) => (x.id === r.id ? { ...x, amount: Math.max(0, v) } : x)))
                  }
                />
              </div>
              <div className="flex w-24 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor={`apMonth${r.id}`}>
                  {r.tipo === 'anual' ? 'no mês' : r.tipo === 'recorrente' ? 'começando no mês' : 'mês'}
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
                updateRows([...rows, { id: ++aporteSeq, tipo: 'pontual', amount: 5000, month: 12, every: 12 }])
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

    <Card className="rounded-2xl bg-white shadow-sm lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela atual</span>
            <span className="text-lg font-semibold">{formatBRL(parcelaBase)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Parcela nova</span>
            <span className="text-lg font-semibold text-primary">{formatBRL(parcelaAtual)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Juros totais</span>
            <span className="text-lg font-semibold">{formatBRL(current.metrics.totalJuros)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-muted/50 p-3">
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
            economia >= 0 ? 'bg-emerald-50' : 'bg-destructive/10'
          }`}
        >
          <span className="text-xs text-muted-foreground">
            {economia >= 0 ? 'Economia total' : 'Custo adicional'}
          </span>
          <span
            className={`text-lg font-semibold ${economia >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
          >
            {economia >= 0 ? formatBRL(economia) : `-${formatBRL(-economia)}`}
          </span>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}