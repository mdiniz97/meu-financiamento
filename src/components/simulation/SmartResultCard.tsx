'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import type { SmartRecommendation } from '@/lib/finance/smart';
import type { FormState } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SmartCalcFields } from './SmartCalculator';

function ComparativoTable({ rec }: { rec: SmartRecommendation }) {
  return (
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
        {rec.comparison.map((c) => (
          <tr key={c.system} className={c.candidate === rec.best ? 'font-semibold' : ''}>
            <td>
              {c.system}
              {c.candidate === rec.best && ' ✓'}
              {!c.feasible && (
                <span className="ml-1 text-muted-foreground">(não cabe no orçamento)</span>
              )}
            </td>
            <td className="text-right">{c.candidate ? `${c.candidate.months} m` : '—'}</td>
            <td className="text-right">
              {c.candidate ? formatBRL(c.candidate.parcela) : `mín. ${formatBRL(c.minParcela)}`}
            </td>
            <td className="text-right">
              {c.candidate ? `${c.candidate.result.metrics.saldoZeroAt} m` : '—'}
            </td>
            <td className="text-right">
              {c.candidate ? formatBRL(c.candidate.result.metrics.totalPago) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  rec: SmartRecommendation;
  fields: SmartCalcFields;
}

export function SmartResultCard({ rec, fields }: Props) {
  const router = useRouter();

  function abrirNoSandbox() {
    if (!rec.best) return;
    const b = rec.best;
    const form: FormState = {
      system: b.system,
      principal: fields.principal,
      annualRate: fields.annualRate,
      months: String(b.months),
      trMonthly: fields.trMonthly,
      insuranceMonthly: fields.insuranceMonthly,
      bank: fields.bank,
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

  if (rec.infeasible) {
    return (
      <Card className="rounded-2xl bg-amber-50">
        <CardContent className="flex flex-col gap-3 pt-6 text-sm text-amber-800">
          <p>
            Com {formatBRL(parseBRLToNumber(fields.maxPayment))}/mês não dá para amortizar esse
            financiamento nem no prazo máximo ({fields.maxMonths} meses). O orçamento mínimo é de{' '}
            <strong>{formatBRL(rec.minBudget)}/mês</strong> — ou aumente o prazo máximo.
          </p>
          <ComparativoTable rec={rec} />
        </CardContent>
      </Card>
    );
  }

  if (!rec.best) return null;
  const b = rec.best;

  return (
    <Card className="rounded-2xl bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Melhor modelo <Sparkles className="size-4 text-[#820AD1]" />
        </CardTitle>
        <CardDescription>
          Menor custo total respeitando seu orçamento de {formatBRL(parseBRLToNumber(fields.maxPayment))}/mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
            <span className="text-xs text-muted-foreground">Modelo e prazo</span>
            <span className="text-lg font-semibold text-primary">
              {b.system} · {b.months} meses ({(b.months / 12).toFixed(1)} anos)
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
            <span className="text-xs text-muted-foreground">Parcela + aporte</span>
            <span className="text-lg font-semibold text-primary">
              {formatBRL(b.parcela)}
              {b.extraMonthlyAmount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {' '}+ aporte {formatBRL(b.extraMonthlyAmount)}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatBRL(b.parcela + b.extraMonthlyAmount)} do orçamento usado
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {b.result.metrics.saldoZeroAt} meses
              <span className="text-xs font-normal text-muted-foreground">
                {' '}({(b.result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 p-3">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold text-emerald-600">
              {formatBRL(b.result.metrics.totalPago)}
            </span>
          </div>
        </div>

        <ComparativoTable rec={rec} />

        {rec.maxTerm && rec.maxTerm !== b && (
          <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            Entrar já no prazo máximo ({rec.maxTerm.months} meses) com o mesmo orçamento: parcela{' '}
            {formatBRL(rec.maxTerm.parcela)} + aporte {formatBRL(rec.maxTerm.extraMonthlyAmount)}, total{' '}
            {formatBRL(rec.maxTerm.result.metrics.totalPago)} —{' '}
            <span className="text-destructive">
              {formatBRL(rec.maxTerm.result.metrics.totalPago - b.result.metrics.totalPago)} a mais
            </span>{' '}
            que o prazo recomendado (mais parcelas de seguro e juros). O prazo máximo só vale a pena
            pela parcela mínima menor — se você nem sempre consegue aportar.
          </p>
        )}

        <div>
          <Button type="button" onClick={abrirNoSandbox}>
            Abrir no sandbox
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
