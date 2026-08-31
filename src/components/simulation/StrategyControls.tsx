'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LoanInput, SimulationResult, Strategies } from '@/lib/finance/types';
import { recurringParcela } from '@/lib/finance/insights';
import { simulate } from '@/lib/finance/engine';
import {
  applyRecommendedPercent,
  addPendingFingerprint,
  clampUntilMonths,
  dedupePctRows,
  deriveRows,
  nextAporteId,
  normalizeAporteRowType,
  reconcileStrategyRows,
  rowStrategiesFingerprint,
  rowsToStrategies,
  type AporteRow,
  type AporteTipo,
} from '@/lib/finance/strategy-rows';
import { formatBRL, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput, parseIntStrict } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface Props {
  input: LoanInput;
  strategies: Strategies;
  onChange: (s: Strategies) => void;
  base: SimulationResult;
  current: SimulationResult;
  /** registra função que adiciona um aporte % extra (usado pelo 'Aplicar aporte' do Raio X) */
  onApplyAporteReady?: (fn: ((ratio: number) => void) | null) => void;
}


const TIPO_LABELS: Record<AporteTipo, string> = {
  pontual: 'Pontual',
  mensal: 'Mensal (total fixo)',
  pct: '% extra mensal',
  recorrente: 'Recorrente',
  anual: 'Anual (FGTS)',
  sac: 'Pagar como no SAC',
};

const MODO_LABELS = { auto: 'Automático', term: 'Reduzir prazo', payment: 'Reduzir parcela' };

function rowPick(r: AporteRow, months: number): Partial<Strategies> {
  const until = (v: number | undefined) => (v !== undefined ? Math.min(v, months) : undefined);
  if (r.tipo === 'pontual' && r.amount > 0 && r.month >= 1) {
    return { extraLumpSum: [{ month: r.month, amount: r.amount, ...(r.mode ? { reduceMode: r.mode } : {}) }] };
  }
  if (r.tipo === 'pct' && r.amount > 0) {
    return {
      extraMonthlyPct: r.amount / 100,
      ...(r.month >= 1 ? { extraMonthlyPctStartMonth: r.month } : {}),
      ...(r.untilMonth ? { extraMonthlyPctUntilMonth: until(r.untilMonth) } : {}),
      ...(r.mode ? { extraMonthlyPctReduceMode: r.mode } : {}),
    };
  }
  if (r.tipo === 'mensal' && r.amount > 0) {
    return {
      fixedPayment: {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: until(r.untilMonth) } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  if (r.tipo === 'recorrente' && r.amount > 0) {
    return {
      recurringExtra: {
        amount: r.amount,
        every: Math.max(1, r.every),
        startMonth: Math.max(1, r.month),
        ...(r.untilMonth ? { untilMonth: until(r.untilMonth) } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  if (r.tipo === 'sac') {
    return { paySacParcela: true };
  }
  if (r.tipo === 'anual' && r.amount > 0) {
    return {
      fgtsAnnual: {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: until(r.untilMonth) } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      },
    };
  }
  return {};
}

export function StrategyControls({ input, strategies, onChange, base, current, onApplyAporteReady }: Props) {
  const [rows, setRows] = useState<AporteRow[]>(() => clampUntilMonths(deriveRows(strategies), input.months));
  const rowsRef = useRef(rows);
  const strategiesRef = useRef(strategies);
  const onChangeRef = useRef(onChange);
  const pendingFingerprintsRef = useRef<string[]>([]);

  const strategiesFingerprint = rowStrategiesFingerprint(strategies);

  useEffect(() => {
    rowsRef.current = rows;
    strategiesRef.current = strategies;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const synchronized = reconcileStrategyRows(
      rowsRef.current,
      strategies,
      pendingFingerprintsRef.current
    );
    pendingFingerprintsRef.current = synchronized.pendingFingerprints;
    if (!synchronized.changed) return;
    const next = clampUntilMonths(synchronized.rows, input.months);
    rowsRef.current = next;
    setRows(next);
  }, [strategies, strategiesFingerprint, input.months]);

  // diferença real entre os modos para cada linha (só mostra o seletor quando há):
  // força o modo da linha em cada simulação, senão um modo explícito tornaria a
  // comparação inútil e esconderia o seletor de uma linha que o aceita
  const rowsInfo = useMemo(
    () =>
      rows.map((r) => {
        const baseRow = { extraLumpSum: [], reduceMode: 'term' as const };
        const withMode = (mode: 'term' | 'payment') =>
          simulate(input, { ...baseRow, ...rowPick({ ...r, mode }, input.months) });
        const t = withMode('term');
        const p = withMode('payment');
        return {
          differs:
            Math.abs(t.metrics.totalPago - p.metrics.totalPago) > 1 ||
            t.metrics.saldoZeroAt !== p.metrics.saldoZeroAt,
          termTotal: t.metrics.totalPago,
          payTotal: p.metrics.totalPago,
        };
      }),
    [input, rows]
  );

  const updateRows = (candidate: AporteRow[]) => {
    const next = clampUntilMonths(dedupePctRows(candidate), input.months);
    const nextStrategies = { ...strategiesRef.current, ...rowsToStrategies(next, input.months) };
    rowsRef.current = next;
    pendingFingerprintsRef.current = addPendingFingerprint(
      pendingFingerprintsRef.current,
      rowStrategiesFingerprint(nextStrategies)
    );
    setRows(next);
    onChangeRef.current(nextStrategies);
  };

  const applyAporte = useCallback((ratio: number) => {
    const next = clampUntilMonths(applyRecommendedPercent(rowsRef.current, ratio), input.months);
    const nextStrategies = { ...strategiesRef.current, ...rowsToStrategies(next, input.months) };
    rowsRef.current = next;
    pendingFingerprintsRef.current = addPendingFingerprint(
      pendingFingerprintsRef.current,
      rowStrategiesFingerprint(nextStrategies)
    );
    setRows(next);
    onChangeRef.current(nextStrategies);
  }, [input]);

  useEffect(() => {
    onApplyAporteReady?.(applyAporte);
    return () => onApplyAporteReady?.(null);
  }, [applyAporte, onApplyAporteReady]);

  const economia = base.metrics.totalPago - current.metrics.totalPago;
  const parcelaBase = recurringParcela(base);
  const parcelaAtual = recurringParcela(current);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-4">
    <Card className="rounded-2xl shadow-sm lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Estratégias</CardTitle>
        <CardDescription>
          Combine aportes pontuais e mensais, com período opcional, e veja os resultados ao vivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Amortizações</h3>
          <p className="text-xs text-muted-foreground">
            Pontuais (uma vez no mês X), recorrentes (a cada X meses) ou anuais (FGTS). Cada uma com
            início e fim opcionais.
          </p>
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma amortização definida.</p>
          )}
          {rows.map((r, ri) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-start gap-2 ${r.amount <= 0 && r.tipo !== 'sac' ? 'opacity-60' : ''}`}
            >
              <div className="w-32">
                <FieldHelp htmlFor={`apType${r.id}`} label="Tipo de amortização" help="Escolha se o aporte acontece uma vez, todo mês, por percentual, em intervalos ou anualmente com FGTS.">
                <Select
                  value={r.tipo}
                  onValueChange={(v) =>
                    updateRows(rows.map((x) =>
                      x.id === r.id ? normalizeAporteRowType(x, v as AporteTipo) : x
                    ))
                  }
                >
                  <SelectTrigger id={`apType${r.id}`} aria-describedby={`apType${r.id}-help`} className="w-full" size="sm">
                    <SelectValue>{TIPO_LABELS[r.tipo]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pontual">Pontual</SelectItem>
                    <SelectItem value="mensal">Mensal (total fixo)</SelectItem>
                    <SelectItem value="pct">% extra mensal</SelectItem>
                    <SelectItem value="recorrente">Recorrente</SelectItem>
                    <SelectItem value="anual">Anual (FGTS)</SelectItem>
                    {input.system === 'PRICE' && (
                      <SelectItem value="sac">Pagar como no SAC</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                </FieldHelp>
              </div>
              {r.tipo === 'sac' ? (
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    Paga no PRICE o valor que pagaria no SAC: a diferença vira amortização extra.
                  </p>
                </div>
              ) : (
              <div className="w-28">
                <FieldHelp
                  htmlFor={`apAmount${r.id}`}
                  label={r.tipo === 'pct' ? 'Percentual (%)' : 'Valor (R$)'}
                  help={r.tipo === 'pct' ? 'Percentual adicional da parcela aplicado todo mês; 14,17 significa 14,17%.' : r.tipo === 'pontual' ? 'Valor pago uma única vez, no mês selecionado, além da parcela.' : 'Valor em reais que será pago além da parcela para reduzir saldo, prazo ou prestação.'}
                >
                  {r.tipo === 'pct' ? (
                    <NumericInput
                      id={`apAmount${r.id}`}
                      aria-describedby={`apAmount${r.id}-help`}
                      aria-label="Percentual (%)"
                      maxLength={8}
                      value={r.amount > 0 ? r.amount : undefined}
                      parse={parseDecimal}
                      onValid={(v) => updateRows(rows.map((x) => (x.id === r.id ? { ...x, amount: Math.max(0, v) } : x)))}
                    />
                  ) : (
                    <MoneyInput
                      id={`apAmount${r.id}`}
                      aria-describedby={`apAmount${r.id}-help`}
                      aria-label="Valor (R$)"
                      value={r.amount > 0 ? r.amount : 0}
                      onValid={(v) => updateRows(rows.map((x) => (x.id === r.id ? { ...x, amount: Math.max(0, v) } : x)))}
                    />
                  )}
                </FieldHelp>
              </div>
              )}
              {r.tipo !== 'sac' && (
              <div className="w-24">
                <FieldHelp htmlFor={`apMonth${r.id}`} label="Mês do aporte" help="Mês do contrato em que o aporte acontece ou começa; mês 1 é a primeira prestação.">
                <NumericInput
                  id={`apMonth${r.id}`}
                  aria-label="Mês do aporte"
                  aria-describedby={`apMonth${r.id}-help`}
                  maxLength={4}
                  value={r.month}
                  parse={parseIntStrict}
                  onValid={(v) =>
                    updateRows(rows.map((x) => (x.id === r.id ? { ...x, month: Math.max(1, v) } : x)))
                  }
                />
                </FieldHelp>
              </div>
              )}
              {r.tipo === 'recorrente' && (
                <div className="w-20">
                  <FieldHelp htmlFor={`apEvery${r.id}`} label="Intervalo (meses)" help="Frequência do aporte recorrente; por exemplo, 6 repete o pagamento a cada seis meses.">
                  <NumericInput
                    id={`apEvery${r.id}`}
                    aria-describedby={`apEvery${r.id}-help`}
                    maxLength={3}
                    value={r.every}
                    parse={parseIntStrict}
                    onValid={(v) =>
                      updateRows(rows.map((x) => (x.id === r.id ? { ...x, every: Math.max(1, v) } : x)))
                    }
                  />
                  </FieldHelp>
                </div>
              )}
              {r.tipo !== 'sac' && r.tipo !== 'pontual' && (
              <div className="w-24">
                <FieldHelp htmlFor={`apUntil${r.id}`} label="Até o mês (opcional)" help="Último mês que recebe este aporte. Deixe vazio para continuar até quitar o financiamento.">
                <NumericInput
                  id={`apUntil${r.id}`}
                  aria-describedby={`apUntil${r.id}-help`}
                  maxLength={4}
                  value={r.untilMonth}
                  parse={(s) => (s.trim() === '' ? 0 : parseIntStrict(s))}
                  onValid={(v) =>
                    updateRows(
                      rows.map((x) => (x.id === r.id ? { ...x, untilMonth: v > 0 ? v : undefined } : x))
                    )
                  }
                />
                </FieldHelp>
              </div>
              )}
              {r.tipo !== 'sac' && rowsInfo[ri]?.differs && (
                <div className="w-32">
                  <FieldHelp htmlFor={`apMode${r.id}`} label="Modo" help="Reduzir prazo mantém a parcela e quita antes; reduzir parcela mantém o prazo e alivia os pagamentos seguintes.">
                  <Select
                    value={r.mode ?? 'auto'}
                    onValueChange={(v) =>
                      updateRows(
                        rows.map((x) =>
                          x.id === r.id
                            ? { ...x, mode: v === 'auto' ? undefined : (v as 'term' | 'payment') }
                            : x
                        )
                      )
                    }
                  >
                    <SelectTrigger id={`apMode${r.id}`} aria-describedby={`apMode${r.id}-help`} className="w-full" size="sm">
                      <SelectValue>{MODO_LABELS[r.mode ?? 'auto']}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="term">Reduzir prazo</SelectItem>
                      <SelectItem value="payment">Reduzir parcela</SelectItem>
                    </SelectContent>
                  </Select>
                  </FieldHelp>
                </div>
              )}
              <Button
                variant="outline"
                size="icon"
                className="mt-[46px]"
                aria-label="Remover"
                onClick={() => updateRows(rows.filter((x) => x.id !== r.id))}
              >
                <Trash2 className="size-4" />
              </Button>
              {r.amount <= 0 && r.tipo !== 'sac' && (
                <p className="w-full text-xs text-muted-foreground">
                  Valor zero: aporte inativo. Digite um valor para ativar.
                </p>
              )}
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateRows([...rows, { id: nextAporteId(rows), tipo: 'pontual', amount: 0, month: 1, every: 12 }])
              }
            >
              <Plus className="size-4" /> Adicionar amortização
            </Button>
          </div>
        </section>

        {input.system === 'PRICE' && (
          <>
            <Separator />
            <section className="flex flex-col gap-1.5">
              <FieldHelp htmlFor="paySacParcela" label="Pagar como no SAC" help="No contrato PRICE, paga a diferença até a parcela equivalente do SAC como amortização extra mensal.">
                <Switch
                  id="paySacParcela"
                  data-field-help-id="paySacParcela"
                  aria-describedby="paySacParcela-help"
                  checked={strategies.paySacParcela === true}
                  onCheckedChange={(checked) => onChange({ ...strategies, paySacParcela: checked })}
                />
              </FieldHelp>
              <p className="text-xs text-muted-foreground">
                Paga no PRICE o valor que pagaria no SAC: a diferença vira amortização extra.
              </p>
            </section>
          </>
        )}

      </CardContent>
    </Card>

    <Card className="rounded-2xl shadow-sm lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Resultado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <section className="flex flex-col gap-3">
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
            economia >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60' : 'bg-destructive/10 dark:bg-destructive/20'
          }`}
        >
          <span className="text-xs text-muted-foreground">
            {economia >= 0 ? 'Economia total' : 'Custo adicional'}
          </span>
          <span
            className={`text-lg font-semibold ${economia >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {economia >= 0 ? formatBRL(economia) : `-${formatBRL(-economia)}`}
          </span>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
