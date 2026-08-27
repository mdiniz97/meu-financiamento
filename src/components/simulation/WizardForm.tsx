'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Plus, Trash2 } from 'lucide-react';
import { BANKS, DEFAULT_FORM, type FormState } from '@/lib/simulation-context';
import { parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SmartCalculator } from './SmartCalculator';

export function WizardForm({ isUnlimited = false }: { isUnlimited?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validate(): string | null {
    const principal = parseBRLToNumber(form.principal);
    const annualRate = parseDecimal(form.annualRate);
    const months = Number(form.months);
    const trMonthly = parseDecimal(form.trMonthly);
    const insuranceMonthly = parseBRLToNumber(form.insuranceMonthly);
    if (!(principal > 0)) return 'Informe o valor financiado (maior que zero).';
    if (!(annualRate > 0)) return 'Informe a taxa anual (maior que zero).';
    if (!(months >= 1 && months <= 600)) return 'Prazo deve estar entre 1 e 600 meses.';
    if (!(trMonthly >= 0)) return 'Informe a TR mensal válida.';
    if (!(insuranceMonthly >= 0)) return 'Informe o seguro mensal válido.';
    if (
      form.portability &&
      !(parseDecimal(form.portability.annualRate) > 0)
    )
      return 'Informe a nova taxa da portabilidade (maior que zero).';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    sessionStorage.setItem('sim-input', JSON.stringify(form));
    router.push('/simulacao?name=');
  }

  return (
    <Card className="w-full max-w-2xl rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Nova simulação</CardTitle>
        <CardDescription>
          Informe os dados do financiamento e explore estratégias de amortização.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">
                Dados do financiamento
              </TabsTrigger>
              <TabsTrigger value="estrategias" className="flex-1">
                Estratégias
              </TabsTrigger>
              <TabsTrigger value="inteligente" className="flex-1">
                Cálculo inteligente ⚡
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="flex flex-col gap-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="principal">Valor financiado (R$)</Label>
                  <Input
                    id="principal"
                    inputMode="numeric"
                    value={form.principal}
                    onChange={(e) => set('principal', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="annualRate">Taxa a.a. (%)</Label>
                  <Input
                    id="annualRate"
                    inputMode="decimal"
                    value={form.annualRate}
                    onChange={(e) => set('annualRate', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="months">Prazo (meses)</Label>
                  <Input
                    id="months"
                    inputMode="numeric"
                    value={form.months}
                    onChange={(e) => set('months', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trMonthly">TR mensal (%)</Label>
                  <Input
                    id="trMonthly"
                    inputMode="decimal"
                    value={form.trMonthly}
                    onChange={(e) => set('trMonthly', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="insuranceMonthly">Seguro (R$/mês)</Label>
                  <Input
                    id="insuranceMonthly"
                    inputMode="numeric"
                    value={form.insuranceMonthly}
                    onChange={(e) => set('insuranceMonthly', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Banco</Label>
                  <Select value={form.bank} onValueChange={(bank) => set('bank', String(bank))}>
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
                <div className="flex flex-col gap-1.5">
                  <Label>Sistema</Label>
                  <RadioGroup
                    value={form.system}
                    onValueChange={(system) => set('system', system as FormState['system'])}
                    className="flex flex-row gap-4"
                  >
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="PRICE" />
                      PRICE
                    </Label>
                    <Label className="flex items-center gap-2 font-normal">
                      <RadioGroupItem value="SAC" />
                      SAC
                    </Label>
                  </RadioGroup>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="estrategias" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label>Amortização extra (lump sum)</Label>
                {form.lumpSum.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma amortização extra definida.</p>
                )}
                <div className="flex flex-col gap-2">
                  {form.lumpSum.map((l, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex w-28 flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">Mês</Label>
                        <Input
                          inputMode="numeric"
                          value={String(l.month)}
                          onChange={(e) =>
                            set(
                              'lumpSum',
                              form.lumpSum.map((x, j) =>
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
                            set(
                              'lumpSum',
                              form.lumpSum.map((x, j) =>
                                j === i ? { ...x, amount: parseBRLToNumber(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Remover"
                        onClick={() => set('lumpSum', form.lumpSum.filter((_, j) => j !== i))}
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
                    onClick={() => set('lumpSum', [...form.lumpSum, { month: 12, amount: 5000 }])}
                  >
                    <Plus className="size-4" /> Adicionar
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="extraMonthlyPct">% extra mensal</Label>
                  <Input
                    id="extraMonthlyPct"
                    inputMode="decimal"
                    value={form.extraMonthlyPct}
                    onChange={(e) => set('extraMonthlyPct', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fgtsAnnual">FGTS anual (R$)</Label>
                  <Input
                    id="fgtsAnnual"
                    inputMode="numeric"
                    value={form.fgtsAnnual}
                    onChange={(e) => set('fgtsAnnual', e.target.value)}
                  />
                </div>
              </div>

              {form.system === 'PRICE' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-2">
                    <Switch
                      checked={form.paySacParcela}
                      onCheckedChange={(checked) => set('paySacParcela', checked)}
                    />
                    Pagar parcela do SAC
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Paga no PRICE o mesmo valor que pagaria no SAC — a diferença vira amortização
                    extra, acelerando a quitação.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Label className="flex items-center gap-2">
                  <Switch
                    checked={form.recurringExtra !== null}
                    onCheckedChange={(checked) =>
                      set(
                        'recurringExtra',
                        checked ? { amount: '10000', every: '12', startMonth: '12' } : null
                      )
                    }
                  />
                  Aporte recorrente
                </Label>
                {form.recurringExtra && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="recAmount">Valor (R$)</Label>
                      <Input
                        id="recAmount"
                        inputMode="numeric"
                        value={form.recurringExtra.amount}
                        onChange={(e) =>
                          set('recurringExtra', { ...form.recurringExtra!, amount: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="recEvery">A cada (meses)</Label>
                      <Input
                        id="recEvery"
                        inputMode="numeric"
                        value={form.recurringExtra.every}
                        onChange={(e) =>
                          set('recurringExtra', { ...form.recurringExtra!, every: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="recStart">Começando no mês</Label>
                      <Input
                        id="recStart"
                        inputMode="numeric"
                        value={form.recurringExtra.startMonth}
                        onChange={(e) =>
                          set('recurringExtra', { ...form.recurringExtra!, startMonth: e.target.value })
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
                        <p><strong>Reduzir parcela:</strong> o aporte abate a dívida e o prazo continua o mesmo — a parcela é recalculada para abater o saldo + correção. Se sua parcela atual não cobre juros + TR, o mínimo que abate pode ser maior que ela.</p>
                        <p className="mt-1"><strong>Reduzir prazo:</strong> o aporte abate a dívida e a parcela continua a mesma — o financiamento termina antes e você paga menos juros.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <RadioGroup
                  value={form.reduceMode}
                  onValueChange={(mode) => set('reduceMode', mode as FormState['reduceMode'])}
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

              <Separator />

              <div className="flex flex-col gap-3">
                <Label className="flex items-center gap-2">
                  <Switch
                    checked={form.portability !== null}
                    onCheckedChange={(checked) =>
                      set(
                        'portability',
                        checked ? { annualRate: form.annualRate, bank: form.bank } : null
                      )
                    }
                  />
                  Portabilidade (nova taxa e novo banco)
                </Label>
                {form.portability && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="portRate">Nova taxa a.a. (%)</Label>
                      <Input
                        id="portRate"
                        inputMode="decimal"
                        value={form.portability.annualRate}
                        onChange={(e) =>
                          set('portability', { ...form.portability!, annualRate: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Novo banco</Label>
                      <Select
                        value={form.portability.bank}
                        onValueChange={(bank) =>
                          set('portability', { ...form.portability!, bank: String(bank) })
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
            </TabsContent>

            <TabsContent value="inteligente" className="flex flex-col gap-4 pt-4">
              <SmartCalculator isUnlimited={isUnlimited} />
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className="text-xs">
              {form.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'}
            </Badge>
            <Button type="submit" className="min-w-32">
              Simular
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
