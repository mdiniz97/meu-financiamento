'use client';

import { Info, Plus, Trash2 } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { BANKS } from '@/lib/simulation-context';
import { recurringParcela } from '@/lib/finance/insights';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export function StrategyControls({ input, strategies, onChange, base, current }: Props) {
  const pctExtra = Math.round((strategies.extraMonthlyPct ?? 0) * 100);

  const setLump = (list: Strategies['extraLumpSum']) => onChange({ ...strategies, extraLumpSum: list });

  const economia = base.metrics.totalPago - current.metrics.totalPago;
  const parcelaBase = recurringParcela(base);
  const parcelaAtual = recurringParcela(current);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Estratégias &quot;e se&quot;</CardTitle>
          <CardDescription>
            Ajuste as estratégias e veja os resultados mudarem ao vivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Amortizar valor no mês</Label>
            {strategies.extraLumpSum.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma amortização extra definida.</p>
            )}
            <div className="flex flex-col gap-2">
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
                      value={l.amount}
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
                    onClick={() =>
                      setLump(strategies.extraLumpSum.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
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
          </div>

          <div className="flex flex-col gap-2">
            <Label>% extra mensal ({pctExtra}%)</Label>
            <div className="flex items-center gap-3">
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
                className="w-20"
                value={pctExtra}
                parse={parseDecimal}
                onValid={(v) => onChange({ ...strategies, extraMonthlyPct: Math.min(100, Math.max(0, v)) / 100 })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fgtsAnnual">FGTS anual (R$)</Label>
            <NumericInput
              id="fgtsAnnual"
              value={strategies.fgtsAnnual}
              parse={parseBRLToNumber}
              onValid={(v) => onChange({ ...strategies, fgtsAnnual: v > 0 ? v : undefined })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fixedPayment">Pagar sempre o mesmo total por mês (R$)</Label>
            <div className="flex items-end gap-2">
              <MoneyInput
                id="fixedPayment"
                value={strategies.fixedPayment?.amount ?? 0}
                onValid={(v) =>
                  onChange({
                    ...strategies,
                    fixedPayment:
                      v > 0
                        ? {
                            amount: v,
                            ...(strategies.fixedPayment?.untilMonth
                              ? { untilMonth: strategies.fixedPayment.untilMonth }
                              : {}),
                          }
                        : undefined,
                  })
                }
              />
              <div className="flex w-36 flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="fixedPaymentUntil">
                  só até o mês (opcional)
                </Label>
                <NumericInput
                  id="fixedPaymentUntil"
                  value={strategies.fixedPayment?.untilMonth}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) =>
                    onChange({
                      ...strategies,
                      fixedPayment: {
                        amount: strategies.fixedPayment?.amount ?? 0,
                        ...(v > 0 ? { untilMonth: v } : {}),
                      },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Parcela + aporte automático = sempre esse valor. Deixe em branco para não usar.
            </p>
          </div>

          {input.system === 'PRICE' && (
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={strategies.paySacParcela === true}
                  onCheckedChange={(checked) => onChange({ ...strategies, paySacParcela: checked })}
                />
                Pagar parcela do SAC
              </Label>
              <p className="text-xs text-muted-foreground">
                Paga no PRICE o mesmo valor que pagaria no SAC: a diferença vira amortização extra,
                acelerando a quitação.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Label className="flex items-center gap-2">
              <Switch
                checked={strategies.recurringExtra !== undefined}
                onCheckedChange={(checked) =>
                  onChange({
                    ...strategies,
                    recurringExtra: checked ? { amount: 10000, every: 12, startMonth: 12 } : undefined,
                  })
                }
              />
              Aporte recorrente
            </Label>
            {strategies.recurringExtra && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recAmount">Valor (R$)</Label>
                  <NumericInput
                    id="recAmount"
                    value={strategies.recurringExtra.amount}
                    parse={parseBRLToNumber}
                    onValid={(v) =>
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, amount: Math.max(0, v) },
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recEvery">A cada (meses)</Label>
                  <NumericInput
                    id="recEvery"
                    value={strategies.recurringExtra.every}
                    parse={parseIntStrict}
                    onValid={(v) =>
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, every: Math.max(1, v) },
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recStart">Começando no mês</Label>
                  <NumericInput
                    id="recStart"
                    value={strategies.recurringExtra.startMonth}
                    parse={parseIntStrict}
                    onValid={(v) =>
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, startMonth: Math.max(1, v) },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              Com a estratégia, prefere
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
          </div>

          <div className="flex flex-col gap-3">
            <Label className="flex items-center gap-2">
              <Switch
                checked={strategies.portability !== undefined}
                onCheckedChange={(checked) =>
                  onChange({
                    ...strategies,
                    portability: checked
                      ? {
                          annualRate: input.annualRate,
                          bank: input.bank,
                          insuranceMonthly: input.insuranceMonthly,
                        }
                      : undefined,
                  })
                }
              />
              Portabilidade
            </Label>
            {strategies.portability && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="portRate">Nova taxa a.a. (%)</Label>
                  <NumericInput
                    id="portRate"
                    value={Math.round(strategies.portability.annualRate * 10000) / 100}
                    parse={parseDecimal}
                    onValid={(v) => {
                      if (!Number.isFinite(v) || v <= 0) return;
                      onChange({
                        ...strategies,
                        portability: {
                          ...strategies.portability!,
                          annualRate: v / 100,
                        },
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Novo banco</Label>
                  <Select
                    value={strategies.portability.bank}
                    onValueChange={(bank) =>
                      onChange({
                        ...strategies,
                        portability: { ...strategies.portability!, bank: String(bank) },
                      })
                    }
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-xs text-muted-foreground">Parcela atual</span>
            <span className="text-lg font-semibold">{formatBRL(parcelaBase)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-xs text-muted-foreground">Parcela nova</span>
            <span className="text-lg font-semibold text-primary">{formatBRL(parcelaAtual)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-xs text-muted-foreground">Juros totais</span>
            <span className="text-lg font-semibold">{formatBRL(current.metrics.totalJuros)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {current.metrics.saldoZeroAt} meses
              <span className="text-xs font-normal text-muted-foreground">
                {' '}({(current.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
        </div>
        <div
          className={`flex flex-col gap-1 rounded-2xl p-4 shadow-sm ${
            economia >= 0 ? 'bg-white' : 'bg-destructive/10'
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
    </div>
  );
}
