'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import { BANKS, type FormState } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

const DEFAULTS = {
  principal: '1000000',
  annualRate: '10.5',
  trMonthly: '0.17',
  insuranceMonthly: '100',
  bank: 'Caixa',
  maxMonths: '360',
  maxPayment: '12000',
};

export function SmartCalculator({ isUnlimited }: { isUnlimited: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(DEFAULTS);
  const [rec, setRec] = useState<SmartRecommendation | null>(null);
  const [error, setError] = useState('');

  const set = (k: keyof typeof DEFAULTS, v: string) => setF((p) => ({ ...p, [k]: v }));

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

    const r = recommendSmart({
      principal,
      annualRate: annualRate / 100,
      trMonthly: trMonthly / 100,
      insuranceMonthly,
      bank: f.bank,
      maxMonths,
      maxPayment,
    });
    setRec(r);
  }

  function abrirNoSandbox() {
    if (!rec?.best) return;
    const b = rec.best;
    const form: FormState = {
      system: b.system,
      principal: f.principal,
      annualRate: f.annualRate,
      months: String(b.months),
      trMonthly: f.trMonthly,
      insuranceMonthly: f.insuranceMonthly,
      bank: f.bank,
      lumpSum: [],
      extraMonthlyPct: String(Math.round(b.extraMonthlyPct * 100)),
      fgtsAnnual: '0',
      recurringExtra: null,
      paySacParcela: false,
      reduceMode: 'term',
      portability: null,
    };
    sessionStorage.setItem('sim-input', JSON.stringify(form));
    router.push('/simulacao?name=melhor-modelo');
  }

  return (
    <Card className="w-full rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          Cálculo inteligente <Sparkles className="size-5 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Diga quanto pode pagar por mês e descubra o melhor modelo, prazo e estratégia.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          <div className="flex flex-col gap-4">
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

      <div>
        <Button type="button" onClick={calcular}>
          <Sparkles className="size-4" /> Calcular melhor modelo
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {rec && rec.infeasible && (
        <Card className="rounded-2xl bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-800">
            Com {formatBRL(parseBRLToNumber(f.maxPayment))}/mês não dá para amortizar esse
            financiamento nem no prazo máximo ({f.maxMonths} meses). O orçamento mínimo é de{' '}
            <strong>{formatBRL(rec.minBudget)}/mês</strong> — ou aumente o prazo máximo.
          </CardContent>
        </Card>
      )}

      {rec && !rec.infeasible && rec.best && (
        <div className="flex flex-col gap-3">
          <Card className="rounded-2xl bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                Melhor modelo <Sparkles className="size-4 text-[#820AD1]" />
              </CardTitle>
              <CardDescription>
                Menor custo total respeitando seu orçamento de {formatBRL(parseBRLToNumber(f.maxPayment))}/mês.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
                  <span className="text-xs text-muted-foreground">Modelo e prazo</span>
                  <span className="text-lg font-semibold text-primary">
                    {rec.best.system} · {rec.best.months} meses ({(rec.best.months / 12).toFixed(1)} anos)
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
                  <span className="text-xs text-muted-foreground">Parcela + aporte</span>
                  <span className="text-lg font-semibold text-primary">
                    {formatBRL(rec.best.parcela)}
                    {rec.best.extraMonthlyAmount > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {' '}+ aporte {formatBRL(rec.best.extraMonthlyAmount)}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBRL(rec.best.parcela + rec.best.extraMonthlyAmount)} do orçamento usado
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
                  <span className="text-xs text-muted-foreground">Quitação</span>
                  <span className="text-lg font-semibold">
                    {rec.best.result.metrics.saldoZeroAt} meses
                    <span className="text-xs font-normal text-muted-foreground">
                      {' '}({(rec.best.result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 p-3">
                  <span className="text-xs text-muted-foreground">Total pago</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {formatBRL(rec.best.result.metrics.totalPago)}
                  </span>
                </div>
              </div>
              {rec.alternatives.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th>Modelo</th>
                      <th className="text-right">Prazo</th>
                      <th className="text-right">Parcela</th>
                      <th className="text-right">Quitação</th>
                      <th className="text-right">Total pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.alternatives.map((a) => (
                      <tr key={a.system} className={a === rec.best ? 'font-semibold' : ''}>
                        <td>{a.system}{a === rec.best && ' ✓'}</td>
                        <td className="text-right">{a.months} m</td>
                        <td className="text-right">{formatBRL(a.parcela)}</td>
                        <td className="text-right">{a.result.metrics.saldoZeroAt} m</td>
                        <td className="text-right">{formatBRL(a.result.metrics.totalPago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div>
                <Button type="button" onClick={abrirNoSandbox}>
                  Abrir no sandbox
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
