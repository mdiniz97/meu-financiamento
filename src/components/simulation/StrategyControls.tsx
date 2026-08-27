'use client';

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

export function StrategyControls({ input, strategies, onChange, base, current }: Props) {
  const pctExtra = Math.round((strategies.extraMonthlyPct ?? 0) * 100);

  const setLump = (list: Strategies['extraLumpSum']) => onChange({ ...strategies, extraLumpSum: list });

  const economia = base.metrics.totalPago - current.metrics.totalPago;
  const parcelaBase = recurringParcela(base);
  const parcelaAtual = recurringParcela(current);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
    <Card className="rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Estratégias</CardTitle>
        <CardDescription>
          Combine aportes pontuais e mensais, com período opcional, e veja os resultados ao vivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Amortização pontual</h3>
          {strategies.extraLumpSum.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma amortização pontual definida.</p>
          )}
          {strategies.extraLumpSum.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex w-28 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Mês</Label>
                <NumericInput
                  value={l.month}
                  parse={parseIntStrict}
                  onValid={(v) =>
                    setLump(
                      strategies.extraLumpSum.map((x, j) =>
                        j === i ? { ...x, month: Math.max(1, v) } : x
                      )
                    )
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <NumericInput
                  value={l.amount > 0 ? l.amount : undefined}
                  parse={parseBRLToNumber}
                  onValid={(v) =>
                    setLump(
                      strategies.extraLumpSum.map((x, j) =>
                        j === i ? { ...x, amount: Math.max(0, v) } : x
                      )
                    )
                  }
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Remover"
                onClick={() => setLump(strategies.extraLumpSum.filter((_, j) => j !== i))}
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
              onClick={() => setLump([...strategies.extraLumpSum, { month: 12, amount: 5000 }])}
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        </section>

        <Separator />

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
          <p className="text-xs text-muted-foreground">
            O % extra paga um percentual a mais na parcela; o pagamento fixo completa até o valor
            total escolhido. Use um ou outro (ou os dois).
          </p>
        </section>
        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Aportes periódicos</h3>
          <div className="flex items-end gap-2">
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor="recAmount">Recorrente (R$)</Label>
              <NumericInput
                id="recAmount"
                value={strategies.recurringExtra?.amount}
                parse={parseBRLToNumber}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    recurringExtra:
                      v > 0
                        ? {
                            amount: v,
                            every: strategies.recurringExtra?.every ?? 12,
                            startMonth: strategies.recurringExtra?.startMonth ?? 12,
                            ...(strategies.recurringExtra?.untilMonth
                              ? { untilMonth: strategies.recurringExtra.untilMonth }
                              : {}),
                          }
                        : undefined,
                  })
                }
              />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="recEvery">
                a cada (meses)
              </Label>
              <NumericInput
                id="recEvery"
                value={strategies.recurringExtra?.every}
                parse={parseIntStrict}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    recurringExtra: {
                      amount: strategies.recurringExtra?.amount ?? 0,
                      every: Math.max(1, v),
                      startMonth: strategies.recurringExtra?.startMonth ?? 12,
                      ...(strategies.recurringExtra?.untilMonth
                        ? { untilMonth: strategies.recurringExtra.untilMonth }
                        : {}),
                    },
                  })
                }
              />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="recStart">
                começando no mês
              </Label>
              <NumericInput
                id="recStart"
                value={strategies.recurringExtra?.startMonth}
                parse={parseIntStrict}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    recurringExtra: {
                      amount: strategies.recurringExtra?.amount ?? 0,
                      every: strategies.recurringExtra?.every ?? 12,
                      startMonth: Math.max(1, v),
                      ...(strategies.recurringExtra?.untilMonth
                        ? { untilMonth: strategies.recurringExtra.untilMonth }
                        : {}),
                    },
                  })
                }
              />
            </div>
            <MesCampo
              id="recUntil"
              label="até o mês (opcional)"
              value={strategies.recurringExtra?.untilMonth}
              onValid={(v) =>
                onChange({
                  ...strategies,
                  recurringExtra: {
                    amount: strategies.recurringExtra?.amount ?? 0,
                    every: strategies.recurringExtra?.every ?? 12,
                    startMonth: strategies.recurringExtra?.startMonth ?? 12,
                    ...(v > 0 ? { untilMonth: v } : {}),
                  },
                })
              }
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex w-40 flex-col gap-1.5">
              <Label htmlFor="fgtsAnnual">FGTS anual (R$)</Label>
              <NumericInput
                id="fgtsAnnual"
                value={strategies.fgtsAnnual?.amount}
                parse={parseBRLToNumber}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    fgtsAnnual:
                      v > 0
                        ? {
                            amount: v,
                            ...(strategies.fgtsAnnual?.startMonth
                              ? { startMonth: strategies.fgtsAnnual.startMonth }
                              : {}),
                            ...(strategies.fgtsAnnual?.untilMonth
                              ? { untilMonth: strategies.fgtsAnnual.untilMonth }
                              : {}),
                          }
                        : undefined,
                  })
                }
              />
            </div>
            <MesCampo
              id="fgtsStart"
              label="começando no mês"
              value={strategies.fgtsAnnual?.startMonth}
              onValid={(v) =>
                onChange({
                  ...strategies,
                  fgtsAnnual: {
                    amount: strategies.fgtsAnnual?.amount ?? 0,
                    startMonth: Math.max(1, v),
                    ...(strategies.fgtsAnnual?.untilMonth
                      ? { untilMonth: strategies.fgtsAnnual.untilMonth }
                      : {}),
                  },
                })
              }
            />
            <MesCampo
              id="fgtsUntil"
              label="até o mês (opcional)"
              value={strategies.fgtsAnnual?.untilMonth}
              onValid={(v) =>
                onChange({
                  ...strategies,
                  fgtsAnnual: {
                    amount: strategies.fgtsAnnual?.amount ?? 0,
                    startMonth: strategies.fgtsAnnual?.startMonth ?? 12,
                    ...(v > 0 ? { untilMonth: v } : {}),
                  },
                })
              }
            />
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

        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            Modo do aporte
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
          </h3>
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
        </section>

      </CardContent>
    </Card>
        <Separator />

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
    </div>
  );
}