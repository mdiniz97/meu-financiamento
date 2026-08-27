'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import { BANKS } from '@/lib/simulation-context';
import { parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

export interface SmartCalcFields {
  principal: string;
  annualRate: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  maxMonths: string;
  maxPayment: string;
}

export const SMART_DEFAULTS: SmartCalcFields = {
  principal: '1000000',
  annualRate: '10.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  maxMonths: '360',
  maxPayment: '12000',
};

interface Props {
  isUnlimited: boolean;
  onCalculated: (rec: SmartRecommendation, fields: SmartCalcFields) => void;
}

export function SmartCalculator({ isUnlimited, onCalculated }: Props) {
  const [f, setF] = useState<SmartCalcFields>(SMART_DEFAULTS);
  const [error, setError] = useState('');

  const set = (k: keyof SmartCalcFields, v: string) => setF((p) => ({ ...p, [k]: v }));

  function calcular() {
    setError('');
    const principal = parseBRLToNumber(f.principal);
    const annualRate = parseDecimal(f.annualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const maxMonths = Number(f.maxMonths);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    if (!(principal > 0)) return setError('Informe o valor financiado (maior que zero).');
    if (!(annualRate > 0)) return setError('Informe a taxa anual (maior que zero).');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro mensal válido.');
    if (!(maxMonths >= 60 && maxMonths <= 600)) return setError('Prazo máximo deve estar entre 60 e 600 meses.');
    if (!(maxPayment > 0)) return setError('Informe quanto pode pagar por mês.');

    const rec = recommendSmart({
      principal,
      annualRate: annualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      bank: f.bank,
      maxMonths,
      maxPayment,
    });
    onCalculated(rec, f);
  }

  return (
    <Card className="flex h-full w-full flex-col rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Cálculo inteligente <Sparkles className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e estratégia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!isUnlimited ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <Sparkles className="mx-auto size-8 text-[#820AD1]" />
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
          <div className="flex flex-1 flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartPrincipal">Valor financiado (R$)</Label>
                <Input id="smartPrincipal" inputMode="numeric" value={f.principal} onChange={(e) => set('principal', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartRate">Taxa a.a. (%)</Label>
                <Input id="smartRate" inputMode="decimal" value={f.annualRate} onChange={(e) => set('annualRate', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartTr">TR mensal (%)</Label>
                <Input id="smartTr" inputMode="decimal" value={f.trMonthly} onChange={(e) => set('trMonthly', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartSeguro">Seguro (R$/mês)</Label>
                <Input id="smartSeguro" inputMode="numeric" value={f.insuranceMonthly} onChange={(e) => set('insuranceMonthly', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Banco</Label>
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
                <Label htmlFor="smartMaxMonths">Prazo máximo (meses)</Label>
                <Input id="smartMaxMonths" inputMode="numeric" value={f.maxMonths} onChange={(e) => set('maxMonths', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="smartMaxPayment">Quanto pode pagar por mês (R$)</Label>
                <Input id="smartMaxPayment" inputMode="numeric" value={f.maxPayment} onChange={(e) => set('maxPayment', e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={calcular}>
                <Sparkles className="size-4" /> Calcular melhor modelo
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
