'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { FormState } from '@/lib/simulation-context';
import { maxFinancing, recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import { BANKS } from '@/lib/simulation-context';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  fixedUntilMonth: string;
  inverseMode: boolean;
}

export const SMART_DEFAULTS: SmartCalcFields = {
  principal: '1000000',
  annualRate: '10.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  maxMonths: '360',
  maxPayment: '12000',
  fixedUntilMonth: '',
  inverseMode: false,
};

interface Props {
  isUnlimited: boolean;
  onCalculated: (rec: SmartRecommendation, fields: SmartCalcFields) => void;
}

export function SmartCalculator({ isUnlimited, onCalculated }: Props) {
  const router = useRouter();
  const [f, setF] = useState<SmartCalcFields>(SMART_DEFAULTS);
  const [error, setError] = useState('');
  const [inverse, setInverse] = useState<{ PRICE: number; SAC: number } | null>(null);

  const set = <K extends keyof SmartCalcFields>(k: K, v: SmartCalcFields[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  function calcular() {
    setError('');
    const principal = parseBRLToNumber(f.principal);
    const annualRate = parseDecimal(f.annualRate);
    const trMonthly = parseDecimal(f.trMonthly);
    const insuranceMonthly = parseBRLToNumber(f.insuranceMonthly);
    const maxMonths = Number(f.maxMonths);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    const until = Number(f.fixedUntilMonth);
    if (!(principal > 0)) return setError('Informe o valor financiado (maior que zero).');
    if (!(annualRate > 0)) return setError('Informe a taxa anual (maior que zero).');
    if (!(trMonthly >= 0)) return setError('Informe a TR mensal válida.');
    if (!(insuranceMonthly >= 0)) return setError('Informe o seguro mensal válido.');
    if (!(maxMonths >= 60 && maxMonths <= 600)) return setError('Prazo máximo deve estar entre 60 e 600 meses.');
    if (!(maxPayment > 0)) return setError('Informe quanto pode pagar por mês.');

    if (f.inverseMode) {
      const mf = maxFinancing({
        maxPayment,
        annualRate: annualRate / 100,
        trMonthly: trMonthly / 100,
        insuranceMonthly,
        bank: f.bank,
        months: maxMonths,
      });
      setInverse(mf);
      return;
    }
    const rec = recommendSmart({
      principal,
      annualRate: annualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      bank: f.bank,
      maxMonths,
      maxPayment,
      fixedUntilMonth: Number.isInteger(until) && until >= 1 ? until : undefined,
    });
    onCalculated(rec, f);
  }

  function abrirInverseNoSandbox(system: 'PRICE' | 'SAC', principal: number) {
    const form: FormState = {
      system,
      principal: String(principal),
      annualRate: f.annualRate,
      months: f.maxMonths,
      trMonthly: f.trMonthly,
      insuranceMonthly: f.insuranceMonthly,
      bank: f.bank,
      lumpSum: [],
      extraMonthlyPct: '0',
      fgtsAnnual: '0',
      recurringExtra: null,
      fixedPayment: '',
      fixedPaymentUntil: '',
      paySacParcela: false,
      reduceMode: 'term',
      portability: null,
    };
    sessionStorage.setItem('sim-input', JSON.stringify(form));
    router.push('/simulacao?name=financiamento-possivel');
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
                <MoneyInput
                id="smartPrincipal"
                value={parseBRLToNumber(f.principal)}
                onValid={(v) => set("principal", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartRate">Taxa a.a. (%)</Label>
                <NumericInput
                id="smartRate"
                value={parseDecimal(f.annualRate)}
                parse={parseDecimal}
                onValid={(v) => set("annualRate", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartTr">TR mensal (%)</Label>
                <NumericInput
                id="smartTr"
                value={parseDecimal(f.trMonthly)}
                parse={parseDecimal}
                onValid={(v) => set("trMonthly", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartSeguro">Seguro (R$/mês)</Label>
                <MoneyInput
                id="smartSeguro"
                value={parseBRLToNumber(f.insuranceMonthly)}
                onValid={(v) => set("insuranceMonthly", String(v))}
              />
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
                <NumericInput
                id="smartMaxMonths"
                value={Number(f.maxMonths)}
                parse={parseIntStrict}
                onValid={(v) => set("maxMonths", String(v))}
              />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartMaxPayment2">Quanto pode pagar por mês (R$)</Label>
                <MoneyInput
                  id="smartMaxPayment2"
                  value={parseBRLToNumber(f.maxPayment)}
                  onValid={(v) => set("maxPayment", String(v))}
                />
                <p className="text-xs text-muted-foreground">
                  Parcela + aporte automático = sempre esse valor, até quitar.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smartFixedUntil">Pagar esse valor só até o mês (opcional)</Label>
                <NumericInput
                  id="smartFixedUntil"
                  value={f.fixedUntilMonth ? Number(f.fixedUntilMonth) : undefined}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) => set('fixedUntilMonth', v > 0 ? String(v) : '')}
                />
                <p className="text-xs text-muted-foreground">
                  Depois, volta a pagar só a parcela do contrato.
                </p>
              </div>
            </div>

            <Label className="flex items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                checked={f.inverseMode}
                onChange={(e) => {
                  set('inverseMode', e.target.checked);
                  setInverse(null);
                }}
                className="size-4 accent-[#820AD1]"
              />
              Quero descobrir o valor do imóvel que posso financiar
            </Label>

            <div className="mt-auto flex justify-end">
              <Button type="button" onClick={calcular}>
                <Sparkles className="size-4" />{' '}
                {f.inverseMode ? 'Calcular financiamento possível' : 'Calcular melhor modelo'}
              </Button>
            </div>

            {inverse && (
              <div className="flex flex-col gap-2 rounded-xl bg-primary/5 p-3 text-xs">
                <p className="text-sm font-semibold text-primary">
                  Com {formatBRL(parseBRLToNumber(f.maxPayment))}/mês você pode financiar até:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['PRICE', 'SAC'] as const).map((s) => (
                    <div key={s} className="flex flex-col gap-1 rounded-xl bg-white p-3">
                      <span className="text-muted-foreground">No {s}</span>
                      <span className="text-lg font-semibold">{formatBRL(inverse[s])}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 w-fit"
                        onClick={() => abrirInverseNoSandbox(s, inverse[s])}
                      >
                        Ver no sandbox
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground">
                  Em {f.maxMonths} meses, com taxa de {parseDecimal(f.annualRate).toFixed(2)}% a.a. e TR{' '}
                  {parseDecimal(f.trMonthly).toFixed(2)}%. A parcela 1 fica no seu teto; no PRICE ela
                  cresce com a TR — no SAC ela cai.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
