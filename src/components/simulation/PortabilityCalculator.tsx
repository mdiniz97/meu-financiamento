'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { comparePortability, type PortabilityResult } from '@/lib/finance/portability';
import type { AmortSystem } from '@/lib/finance/types';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

const DEFAULTS = {
  principal: '800000',
  currentSystem: 'PRICE' as AmortSystem,
  currentAnnualRate: '11.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  months: '300',
  bank: 'Caixa',
  newSystem: 'PRICE' as AmortSystem,
  newAnnualRate: '9',
  newInsuranceMonthly: '100',
  newBank: 'Itaú',
  costs: '0',
};

export function PortabilityCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const [f, setF] = useState(DEFAULTS);
  const [result, setResult] = useState<PortabilityResult | null>(null);
  const [error, setError] = useState('');

  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function calcular() {
    setError('');
    setResult(null);
    const principal = parseBRLToNumber(f.principal);
    const currentAnnualRate = parseDecimal(f.currentAnnualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const months = Number(f.months);
    const newAnnualRate = parseDecimal(f.newAnnualRate);
    const newInsuranceMonthly = parseBRLToNumber(f.newInsuranceMonthly);
    const costs = parseBRLToNumber(f.costs);
    if (!(principal > 0)) return setError('Informe o saldo devedor atual (maior que zero).');
    if (!(currentAnnualRate > 0)) return setError('Informe a taxa atual (maior que zero).');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro atual válido.');
    if (!(months >= 1 && months <= 600)) return setError('Parcelas restantes entre 1 e 600.');
    if (!(newAnnualRate > 0)) return setError('Informe a nova taxa (maior que zero).');
    if (!(newInsuranceMonthly >= 0)) return setError('Informe o novo seguro válido.');
    if (!(costs >= 0)) return setError('Custos não podem ser negativos.');

    const r = comparePortability({
      principal,
      currentSystem: f.currentSystem,
      currentAnnualRate: currentAnnualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      months,
      bank: f.bank,
      newSystem: f.newSystem,
      newAnnualRate: newAnnualRate / 100,
      newInsuranceMonthly,
      newBank: f.newBank,
      costs,
    });
    setResult(r);
  }

  const vantajoso = (result?.economia ?? 0) > 0;

  return (
    <Card className="rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Portabilidade <ArrowLeftRight className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Informe seu financiamento atual e a proposta do novo banco — veja se vale a pena portar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isUnlimited ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <ArrowLeftRight className="mx-auto size-8 text-[#820AD1]" />
            <p className="text-sm text-muted-foreground">
              Recurso exclusivo do plano Ilimitado.
            </p>
            <Badge variant="secondary" className="mx-auto text-xs">
              Exclusivo Ilimitado
            </Badge>
            <Link href="/planos" className="mx-auto text-sm font-medium text-[#820AD1]">
              Ver planos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portPrincipal">Saldo devedor atual (R$)</Label>
                <Input id="portPrincipal" inputMode="numeric" value={f.principal} onChange={(e) => set('principal', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portMonths">Parcelas restantes</Label>
                <Input id="portMonths" inputMode="numeric" value={f.months} onChange={(e) => set('months', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portCurrentRate">Taxa atual a.a. (%)</Label>
                <Input id="portCurrentRate" inputMode="decimal" value={f.currentAnnualRate} onChange={(e) => set('currentAnnualRate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portTr">TR mensal (%)</Label>
                <Input id="portTr" inputMode="decimal" value={f.trMonthly} onChange={(e) => set('trMonthly', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portSeguro">Seguro atual (R$/mês)</Label>
                <Input id="portSeguro" inputMode="numeric" value={f.insuranceMonthly} onChange={(e) => set('insuranceMonthly', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Banco atual</Label>
                <Select value={f.bank} onValueChange={(v) => set('bank', String(v))}>
                  <SelectTrigger className="w-full">
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
                <Label>Sistema atual</Label>
                <RadioGroup
                  value={f.currentSystem}
                  onValueChange={(v) => set('currentSystem', v as AmortSystem)}
                  className="flex flex-row gap-4"
                >
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PRICE" /> PRICE
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="SAC" /> SAC
                  </Label>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portNewRate">Nova taxa a.a. (%)</Label>
                <Input id="portNewRate" inputMode="decimal" value={f.newAnnualRate} onChange={(e) => set('newAnnualRate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portNewSeguro">Novo seguro (R$/mês)</Label>
                <Input id="portNewSeguro" inputMode="numeric" value={f.newInsuranceMonthly} onChange={(e) => set('newInsuranceMonthly', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Novo banco</Label>
                <Select value={f.newBank} onValueChange={(v) => set('newBank', String(v))}>
                  <SelectTrigger className="w-full">
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
                <Label htmlFor="portNewSystem">Novo sistema</Label>
                <RadioGroup
                  value={f.newSystem}
                  onValueChange={(v) => set('newSystem', v as AmortSystem)}
                  className="flex flex-row gap-4"
                >
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PRICE" /> PRICE
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="SAC" /> SAC
                  </Label>
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="portCosts">Custos da portabilidade (R$)</Label>
                <Input id="portCosts" inputMode="numeric" value={f.costs} onChange={(e) => set('costs', e.target.value)} />
              </div>
            </div>

            <div>
              <Button type="button" onClick={calcular}>
                <ArrowLeftRight className="size-4" /> Calcular portabilidade
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {result && (
              <div className="flex flex-col gap-4">
                <div
                  className={`rounded-xl p-4 text-sm ${
                    vantajoso ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {vantajoso ? (
                    <>
                      <strong>Vale a pena portar!</strong> Você economiza{' '}
                      <strong>{formatBRL(result.economia)}</strong> no total
                      {result.paybackMonth
                        ? ` — a economia acumulada cobre os custos no mês ${result.paybackMonth} (${(result.paybackMonth / 12).toFixed(1)} anos)`
                        : ' (sem custos, a economia é imediata)'}
                      .
                    </>
                  ) : (
                    <>
                      <strong>Não vale a pena.</strong> Manter o contrato atual é{' '}
                      <strong>{formatBRL(-result.economia)}</strong> mais barato que portar.
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Parcela atual</span>
                    <span className="text-lg font-semibold">
                      {formatBRL(result.keep.installments[0]?.parcela ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.keep.metrics.saldoZeroAt} meses restantes
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Parcela portada</span>
                    <span
                      className={`text-lg font-semibold ${
                        (result.keep.installments[0]?.parcela ?? 0) > (result.ported.installments[0]?.parcela ?? 0)
                          ? 'text-emerald-600'
                          : 'text-destructive'
                      }`}
                    >
                      {formatBRL(result.ported.installments[0]?.parcela ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.ported.metrics.saldoZeroAt} meses no novo contrato
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Total pago hoje</span>
                    <span className="text-lg font-semibold">{formatBRL(result.keep.metrics.totalPago)}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3">
                    <span className="text-xs text-muted-foreground">Total pago portando</span>
                    <span className="text-lg font-semibold">{formatBRL(result.ported.metrics.totalPago)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
