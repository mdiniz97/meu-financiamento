'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';
import type { SmartRecommendation } from '@/lib/finance/smart';
import type { FormState } from '@/lib/simulation-context';
import { formatBRL, parseBRLToNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
            <td className="text-right">{c.candidate ? `${c.candidate.months} m` : '-'}</td>
            <td className="text-right">
              {c.candidate ? formatBRL(c.candidate.parcela) : `mín. ${formatBRL(c.minParcela)}`}
            </td>
            <td className="text-right">
              {c.candidate ? `${c.candidate.result.metrics.saldoZeroAt} m` : '-'}
            </td>
            <td className="text-right">
              {c.candidate ? formatBRL(c.candidate.result.metrics.totalPago) : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScenarioMiniCard({
  title,
  subtitle,
  parcela,
  aporte,
  quita,
  total,
  diff,
  highlight,
  onOpen,
}: {
  title: string;
  subtitle: string;
  parcela: number;
  aporte: number;
  quita: number;
  total: number;
  diff?: number;
  highlight?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div
      className={`flex h-full flex-col gap-1 rounded-2xl p-3 text-xs ${
        highlight ? 'bg-primary/5 dark:bg-[#820AD1]/15 ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : 'bg-muted/50 dark:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`font-semibold ${highlight ? 'text-[#820AD1]' : ''}`}>{title}</span>
        {highlight && (
          <Badge variant="secondary" className="text-[10px]">
            Melhor
          </Badge>
        )}
      </div>
      <span className="text-muted-foreground">{subtitle}</span>
      <span className="mt-1 text-base font-semibold">
        {formatBRL(parcela)}
        {aporte > 0 && (
          <span className="text-xs font-normal text-muted-foreground"> + aporte {formatBRL(aporte)}</span>
        )}
      </span>
      <span>
        Quita em <strong>{quita} meses</strong> ({(quita / 12).toFixed(1)} anos)
      </span>
      <span>
        Total <strong>{formatBRL(total)}</strong>
      </span>
      {diff !== undefined && diff > 0 && (
        <span className="text-destructive">R$ {formatBRL(diff)} a mais que o recomendado</span>
      )}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-auto flex items-center gap-1 self-end pt-2 text-xs font-medium text-[#820AD1] hover:underline"
        >
          Abrir no simulador <ArrowRight className="size-3" />
        </button>
      )}
    </div>
  );
}

interface Props {
  rec: SmartRecommendation;
  fields: SmartCalcFields;
}

export function SmartResultCard({ rec, fields }: Props) {
  const router = useRouter();

  function abrirCenario(c: { system: string; months: number }) {
    const form: FormState = {
      system: c.system as FormState['system'],
      principal: fields.principal,
      annualRate: fields.annualRate,
      months: String(c.months),
      trMonthly: fields.trMonthly,
      insuranceMonthly: fields.insuranceMonthly,
      bank: fields.bank,
      lumpSum: [],
      extraMonthlyPct: '0',
      extraMonthlyPctStart: '',
      extraMonthlyPctUntil: '',
      fixedPaymentStart: '',
      fgtsAnnual: '0',
      fgtsStartMonth: '12',
      fgtsUntilMonth: '',
      recurringExtra: null,
      fixedPayment: fields.maxPayment,
      fixedPaymentUntil: fields.fixedUntilMonth ?? '',
      paySacParcela: false,
      reduceMode: 'term',
      portability: null,
    };
    sessionStorage.setItem('sim-input', JSON.stringify(form));
    router.push('/simulacao?name=melhor-modelo');
  }

  if (rec.infeasible) {
    return (
      <Card className="rounded-2xl bg-amber-50 dark:bg-amber-950/60">
        <CardContent className="flex flex-col gap-3 pt-6 text-sm text-amber-800 dark:text-amber-300">
          <p>
            Com {formatBRL(parseBRLToNumber(fields.maxPayment))}/mês não dá para amortizar esse
            financiamento nem no prazo máximo ({fields.maxMonths} meses). O orçamento mínimo é de{' '}
            <strong>{formatBRL(rec.minBudget)}/mês</strong> (ou aumente o prazo máximo).
          </p>
          <ComparativoTable rec={rec} />
        </CardContent>
      </Card>
    );
  }

  if (!rec.best) return null;
  const b = rec.best;

  return (
    <Card className="rounded-2xl shadow-sm">
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
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 dark:bg-[#820AD1]/15 p-3">
            <span className="text-xs text-muted-foreground">Modelo e prazo</span>
            <span className="text-lg font-semibold text-primary">
              {b.system} · {b.months} meses ({(b.months / 12).toFixed(1)} anos)
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-primary/5 dark:bg-[#820AD1]/15 p-3">
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
          <div className="flex flex-col gap-1 rounded-xl bg-muted p-3 shadow-sm">
            <span className="text-xs text-muted-foreground">Quitação</span>
            <span className="text-lg font-semibold">
              {b.result.metrics.saldoZeroAt} meses
              <span className="text-xs font-normal text-muted-foreground">
                {' '}({(b.result.metrics.saldoZeroAt / 12).toFixed(1)} anos)
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3">
            <span className="text-xs text-muted-foreground">Total pago</span>
            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBRL(b.result.metrics.totalPago)}
            </span>
          </div>
        </div>

        <ComparativoTable rec={rec} />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">E o aporte: reduzir o prazo ou a parcela?</p>
          <p className="text-xs text-muted-foreground">
            O cálculo inteligente avalia os dois e recomenda o de menor custo total. A alternativa
            também aparece, caso você prefira outro perfil.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['term', 'Reduzir o prazo', 'Quita antes, mantendo a parcela'],
                ['payment', 'Reduzir a parcela', 'Mantém o prazo com valor mensal menor'],
              ] as const
            ).map(([mode, titulo, subtitulo]) => {
              const c = rec.modes[mode];
              if (!c) {
                if (mode === 'payment' && rec.paymentMinParcela !== null) {
                  return (
                    <div
                      key={mode}
                      className="flex flex-col gap-1 rounded-2xl bg-muted/30 dark:bg-zinc-800/40 p-3 text-xs opacity-80"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                        <Lock className="size-3" /> Reduzir a parcela
                      </div>
                      <span className="text-muted-foreground">Mantém o prazo com valor mensal menor</span>
                      <span className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                        Não cabe no seu orçamento: a parcela mínima que abate a dívida é de{' '}
                        {formatBRL(rec.paymentMinParcela)}/mês.
                      </span>
                    </div>
                  );
                }
                return null;
              }
              const melhor = rec.best && c.result.metrics.totalPago === rec.best.result.metrics.totalPago;
              return (
                <ScenarioMiniCard
                  key={mode}
                  title={titulo}
                  subtitle={subtitulo}
                  parcela={c.parcela}
                  aporte={c.extraMonthlyAmount}
                  quita={c.result.metrics.saldoZeroAt}
                  total={c.result.metrics.totalPago}
                  highlight={Boolean(melhor)}
                  diff={melhor ? undefined : c.result.metrics.totalPago - (rec.best?.result.metrics.totalPago ?? 0)}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">E se eu entrar direto no prazo máximo?</p>
          <p className="text-xs text-muted-foreground">
            Entrar no prazo máximo paga <strong>mais no total</strong> (mais parcelas de seguro e
            juros), mas a parcela mínima é menor: útil se você nem sempre consegue aportar o valor
            cheio.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ScenarioMiniCard
              title={`${b.system} · ${b.months} meses`}
              subtitle="Melhor prazo para o seu orçamento"
              parcela={b.parcela}
              aporte={b.extraMonthlyAmount}
              quita={b.result.metrics.saldoZeroAt}
              total={b.result.metrics.totalPago}
              highlight
              onOpen={() => abrirCenario(b)}
            />
            {rec.comparison.map((c) => {
              const t = rec.maxTerms.find((mt) => mt.system === c.system);
              if (!c.feasible || !t) {
                return (
                  <div
                    key={c.system}
                    className="flex flex-col gap-1 rounded-2xl bg-muted/30 dark:bg-zinc-800/40 p-3 text-xs opacity-80"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                      <Lock className="size-3" /> {c.system} · 360 meses
                    </div>
                    <span className="text-muted-foreground">Entrando já no prazo máximo</span>
                    <span className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                      Não cabe no seu orçamento: precisa de no mínimo {formatBRL(c.minParcela)}/mês.
                    </span>
                  </div>
                );
              }
              return (
                <ScenarioMiniCard
                  key={t.system}
                  title={`${t.system} · ${t.months} meses`}
                  subtitle="Entrando já no prazo máximo"
                  parcela={t.parcela}
                  aporte={t.extraMonthlyAmount}
                  quita={t.result.metrics.saldoZeroAt}
                  total={t.result.metrics.totalPago}
                  diff={t.result.metrics.totalPago - b.result.metrics.totalPago}
                  onOpen={() => abrirCenario(t)}
                />
              );
            })}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
