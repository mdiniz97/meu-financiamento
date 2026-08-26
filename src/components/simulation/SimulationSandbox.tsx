'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { simulate } from '@/lib/finance/engine';
import { recommend } from '@/lib/finance/recommend';
import type { LoanInput, Strategies } from '@/lib/finance/types';
import {
  DEFAULT_FORM,
  formToInput,
  formToStrategies,
  parseSimulationJson,
  parseStoredForm,
  type FormState,
} from '@/lib/simulation-context';
import { formatBRL } from '@/lib/utils';
import { saveSimulation, type SaveResult } from '@/app/(app)/simulacao/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BalanceChart } from './charts/BalanceChart';
import { CompareChart } from './charts/CompareChart';
import { InterestAmortChart } from './charts/InterestAmortChart';
import { InstallmentTable } from './InstallmentTable';
import { MetricsGrid } from './MetricsGrid';
import { RecommendationCard } from './RecommendationCard';
import { ScenarioCompare } from './ScenarioCompare';
import { StrategyControls } from './StrategyControls';

const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };
const SIM_INPUT_KEY = 'sim-input';

export interface SavedSimulation {
  id: string;
  name: string;
  payload: unknown;
  result: unknown;
  system: string;
  createdAt: Date;
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let cachedRaw: string | null = null;
let cached: { form: FormState; strategies: Strategies; input: LoanInput | null } | null = null;

function loadSnapshot(): { form: FormState; strategies: Strategies; input: LoanInput | null } {
  const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SIM_INPUT_KEY);
  if (raw !== cachedRaw || cached === null) {
    cachedRaw = raw;
    const loaded = parseStoredForm(raw);
    cached = { form: loaded, strategies: formToStrategies(loaded), input: null };
  }
  return cached;
}

const SERVER_SNAPSHOT = {
  form: DEFAULT_FORM,
  strategies: formToStrategies(DEFAULT_FORM),
  input: null,
};

function setCachedStrategies(s: Strategies) {
  if (!cached) return;
  cached = { ...cached, strategies: s };
}

export function SimulationSandbox({ saved }: { saved?: SavedSimulation | null }) {
  const snapshot = useSyncExternalStore(subscribe, loadSnapshot, () => SERVER_SNAPSHOT);
  const strategies = snapshot.strategies;
  const savedIdRef = useRef<string | null>(null);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState('');
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  useEffect(() => {
    if (!saved || savedIdRef.current === saved.id) return;
    savedIdRef.current = saved.id;
    const payload = parseSimulationJson<{
      input: LoanInput;
      strategies: Strategies;
    }>(saved.payload);
    if (!payload?.input) return;
    cached = {
      form: parseStoredForm(null),
      strategies: payload.strategies,
      input: payload.input,
    };
    listeners.forEach((l) => l());
  }, [saved]);

  const input: LoanInput | null = useMemo(
    () => snapshot.input ?? formToInput(snapshot.form),
    [snapshot]
  );
  const base = useMemo(() => (input ? simulate(input, EMPTY) : null), [input]);
  const current = useMemo(
    () => (input ? simulate(input, strategies) : null),
    [input, strategies]
  );
  const recommendation = useMemo(
    () => (input ? recommend(input, [EMPTY, strategies]) : null),
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
  const balanceData = useMemo(
    () => current?.installments.map(({ month, saldo }) => ({ month, saldo })) ?? [],
    [current]
  );
  const baseSaldos = useMemo(() => base?.installments.map((i) => i.saldo) ?? [], [base]);
  const currentSaldos = useMemo(
    () => current?.installments.map((i) => i.saldo) ?? [],
    [current]
  );

  async function handleSave() {
    if (!input) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const result = {
        price: simulate({ ...input, system: 'PRICE' }, strategies),
        sac: simulate({ ...input, system: 'SAC' }, strategies),
      };
      const res: SaveResult = await saveSimulation(input, strategies, result);
      if ('error' in res) {
        setShowCreditsDialog(true);
        setSaveState('idle');
        return;
      }
      setSaveState('saved');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar a simulação.');
      setSaveState('idle');
    }
  }

  if (!input || !base || !current || !systemCompare) {
    return <div className="py-20 text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{saved?.name ?? 'Sandbox de simulação'}</h1>
          <p className="text-sm text-muted-foreground">
            {input.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'} · {formatBRL(input.principal)} ·{' '}
            {(input.annualRate * 100).toFixed(2)}% a.a. · {input.months} meses · {input.bank}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === 'saved' && (
            <Link href="/minhas-simulacoes" className="text-sm font-medium text-[#820AD1]">
              Ver minhas simulações →
            </Link>
          )}
          {saveError && <span className="text-sm text-destructive">{saveError}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Salvando…' : 'Salvar simulação'}
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/nova-simulacao" />}>
            Nova simulação
          </Button>
        </div>
      </div>

      <RecommendationCard base={base} best={recommendation?.best ?? base} />

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
        <h2 className="text-lg font-semibold">Gráficos</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <BalanceChart data={balanceData} />
          <InterestAmortChart installments={current.installments} />
          <div className="lg:col-span-2">
            <CompareChart base={baseSaldos} withStrategy={currentSaldos} />
          </div>
        </div>
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

      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créditos insuficientes</DialogTitle>
            <DialogDescription>
              Salvar uma simulação custa 2 créditos (1 por sistema: PRICE e SAC). Adquira um pacote
              de créditos ou assine o plano para salvar sem limites.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
            <Button nativeButton={false} render={<Link href="/planos" />}>
              Ver planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
