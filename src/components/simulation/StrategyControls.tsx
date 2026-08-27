'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

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
  const parcelaBase = base.installments[0]?.parcela ?? 0;
  const parcelaAtual = current.installments[0]?.parcela ?? 0;

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
                    <Input
                      inputMode="numeric"
                      value={String(l.month)}
                      onChange={(e) =>
                        setLump(
                          strategies.extraLumpSum.map((x, j) =>
                            j === i ? { ...x, month: Math.max(1, Number(e.target.value) || 0) } : x
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input
                      inputMode="numeric"
                      value={String(l.amount)}
                      onChange={(e) =>
                        setLump(
                          strategies.extraLumpSum.map((x, j) =>
                            j === i ? { ...x, amount: parseBRLToNumber(e.target.value) } : x
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
              <Input
                id="extraMonthlyPct"
                className="w-20"
                inputMode="numeric"
                value={String(pctExtra)}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  onChange({ ...strategies, extraMonthlyPct: v / 100 });
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fgtsAnnual">FGTS anual (R$)</Label>
            <Input
              id="fgtsAnnual"
              inputMode="numeric"
              value={strategies.fgtsAnnual ? String(strategies.fgtsAnnual) : ''}
              onChange={(e) => {
                const v = parseBRLToNumber(e.target.value);
                onChange({ ...strategies, fgtsAnnual: v > 0 ? v : undefined });
              }}
            />
          </div>

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
                  <Input
                    id="recAmount"
                    inputMode="numeric"
                    value={String(strategies.recurringExtra.amount)}
                    onChange={(e) => {
                      const v = parseBRLToNumber(e.target.value);
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, amount: v > 0 ? v : 0 },
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recEvery">A cada (meses)</Label>
                  <Input
                    id="recEvery"
                    inputMode="numeric"
                    value={String(strategies.recurringExtra.every)}
                    onChange={(e) => {
                      const v = Math.max(1, Math.round(Number(e.target.value) || 0));
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, every: v },
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recStart">Começando no mês</Label>
                  <Input
                    id="recStart"
                    inputMode="numeric"
                    value={String(strategies.recurringExtra.startMonth)}
                    onChange={(e) => {
                      const v = Math.max(1, Math.round(Number(e.target.value) || 0));
                      onChange({
                        ...strategies,
                        recurringExtra: { ...strategies.recurringExtra!, startMonth: v },
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Com a estratégia, prefere</Label>
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
                  <Input
                    id="portRate"
                    inputMode="decimal"
                    value={String(Math.round(strategies.portability.annualRate * 10000) / 100)}
                    onChange={(e) => {
                      const v = parseDecimal(e.target.value);
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
            <span className="text-lg font-semibold">{current.metrics.saldoZeroAt} meses</span>
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
