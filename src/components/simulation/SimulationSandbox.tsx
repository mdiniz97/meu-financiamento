'use client';

import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { simulate } from '@/lib/finance/engine';
import type { LoanInput, Strategies } from '@/lib/finance/types';
import { DEFAULT_FORM, formToInput, formToStrategies, type FormState } from '@/lib/simulation-context';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InstallmentTable } from './InstallmentTable';
import { MetricsGrid } from './MetricsGrid';
import { ScenarioCompare } from './ScenarioCompare';
import { StrategyControls } from './StrategyControls';

const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };
const SIM_INPUT_KEY = 'sim-input';

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let cachedRaw: string | null = null;
let cached: { form: FormState; strategies: Strategies } | null = null;

function loadSnapshot(): { form: FormState; strategies: Strategies } {
  const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SIM_INPUT_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    let loaded: FormState = DEFAULT_FORM;
    if (raw) {
      try {
        loaded = { ...DEFAULT_FORM, ...(JSON.parse(raw) as FormState) };
      } catch {
        loaded = DEFAULT_FORM;
      }
    }
    cached = { form: loaded, strategies: formToStrategies(loaded) };
  }
  return cached!;
}

const SERVER_SNAPSHOT = { form: DEFAULT_FORM, strategies: formToStrategies(DEFAULT_FORM) };

export function SimulationSandbox() {
  const snapshot = useSyncExternalStore(subscribe, loadSnapshot, () => SERVER_SNAPSHOT);
  const form = snapshot.form;
  const strategies = snapshot.strategies;

  const input: LoanInput | null = useMemo(() => formToInput(form), [form]);
  const base = useMemo(() => (input ? simulate(input, EMPTY) : null), [input]);
  const current = useMemo(
    () => (input ? simulate(input, strategies) : null),
    [input, strategies]
  );
  const systemCompare = useMemo(
    () =>
      input
        ? {
            PRICE: simulate({ ...input, system: 'PRICE' }, EMPTY),
            SAC: simulate({ ...input, system: 'SAC' }, EMPTY),
          }
        : null,
    [input]
  );

  if (!input || !base || !current || !systemCompare) {
    return <div className="py-20 text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sandbox de simulação</h1>
          <p className="text-sm text-muted-foreground">
            {input.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'} · {formatBRL(input.principal)} ·{' '}
            {(input.annualRate * 100).toFixed(2)}% a.a. · {input.months} meses · {input.bank}
          </p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/nova-simulacao" />}>
          Nova simulação
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">PRICE</span>
            <Badge variant="secondary" className="text-xs">
              {formatBRL(systemCompare.PRICE.metrics.totalPago)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Juros {formatBRL(systemCompare.PRICE.metrics.totalJuros)} · Quita em{' '}
            {systemCompare.PRICE.metrics.saldoZeroAt} meses
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">SAC</span>
            <Badge variant="secondary" className="text-xs">
              {formatBRL(systemCompare.SAC.metrics.totalPago)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Juros {formatBRL(systemCompare.SAC.metrics.totalJuros)} · Quita em{' '}
            {systemCompare.SAC.metrics.saldoZeroAt} meses
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Métricas</h2>
        <MetricsGrid metrics={current.metrics} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tabela de parcelas</h2>
        <InstallmentTable installments={current.installments} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Estratégias</h2>
        <StrategyControls
          input={input}
          strategies={strategies}
          onChange={(s) => {
            setCachedStrategies(s);
            listeners.forEach((l) => l());
          }}
          base={base}
          current={current}
        />
      </section>

      <ScenarioCompare input={input} base={base} current={current} />
    </div>
  );
}

function setCachedStrategies(s: Strategies) {
  if (!cached) return;
  cached = { ...cached, strategies: s };
}
