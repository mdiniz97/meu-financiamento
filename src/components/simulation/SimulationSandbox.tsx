'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { simulate, validateLoanInput } from '@/lib/finance/engine';
import { recommend } from '@/lib/finance/recommend';
import type { AmortSystem, LoanInput, Strategies } from '@/lib/finance/types';
import {
  DEFAULT_FORM,
  SIM_INPUT_KEY,
  formToInput,
  formToStrategies,
  parseSimulationJson,
  parseStoredForm,
  type FormState,
} from '@/lib/simulation-context';
import { formatBRL } from '@/lib/utils';
import { clampStrategyUntilMonths } from '@/lib/finance/strategy-rows';
import { saveSimulation, type SaveResult } from '@/app/(app)/simulacao/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FieldHelp } from '@/components/ui/field-help';
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
import { ExportPdfButton } from './ExportPdfButton';
import { InstallmentTable } from './InstallmentTable';
import { MetricsGrid } from './MetricsGrid';
import { DebtInsightCard } from './DebtInsightCard';
import { RecommendationCard } from './RecommendationCard';
import { ScenarioCompare } from './ScenarioCompare';
import { StrategyControls } from './StrategyControls';
import { UpgradeCard } from '@/components/upgrade-card';

const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };

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
  // Sem nova entrada (auto-save já consumiu a chave e o refresh re-renderiza),
  // preserva o estado atual em vez de reverter para o default.
  if (raw === null && cached !== null) return cached;
  if (raw !== cachedRaw || cached === null) {
    cachedRaw = raw;
    const loaded = parseStoredForm(raw);
    cached = {
      form: loaded,
      strategies: clampStrategyUntilMonths(formToStrategies(loaded), Number(loaded.months)),
      input: null,
    };
  }
  return cached;
}

const SERVER_SNAPSHOT = {
  form: DEFAULT_FORM,
  strategies: clampStrategyUntilMonths(formToStrategies(DEFAULT_FORM), Number(DEFAULT_FORM.months)),
  input: null,
};

function setCachedStrategies(s: Strategies) {
  if (!cached) return;
  cached = { ...cached, strategies: s };
}

export function SimulationSandbox({
  saved,
  isUnlimited = false,
}: {
  saved?: SavedSimulation | null;
  isUnlimited?: boolean;
}) {
  const snapshot = useSyncExternalStore(subscribe, loadSnapshot, () => SERVER_SNAPSHOT);
  const router = useRouter();
  const strategies = snapshot.strategies;
  const savedIdRef = useRef<string | null>(null);
  const applyAporteRef = useRef<((ratio: number) => void) | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState('');
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [compareSystems, setCompareSystems] = useState(false);
  const [activeSystem, setActiveSystem] = useState<AmortSystem | null>(null);
  const registerApplyAporte = useCallback((fn: ((ratio: number) => void) | null) => {
    applyAporteRef.current = fn;
  }, []);

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
      strategies: clampStrategyUntilMonths(payload.strategies, payload.input.months),
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
      compareSystems && input
        ? {
            PRICE: simulate({ ...input, system: 'PRICE' }, strategies),
            SAC: simulate({ ...input, system: 'SAC' }, strategies),
          }
        : null,
    [input, strategies, compareSystems]
  );
  const primarySystem: AmortSystem = compareSystems ? activeSystem ?? input.system : input.system;
  const displayed = (compareSystems && systemCompare ? systemCompare[primarySystem] : current) ?? current;
  const balanceData = useMemo(
    () => displayed?.installments.map(({ month, saldo }) => ({ month, saldo })) ?? [],
    [displayed]
  );
  const baseSaldos = useMemo(() => base?.installments.map((i) => i.saldo) ?? [], [base]);
  const currentSaldos = useMemo(
    () => displayed?.installments.map((i) => i.saldo) ?? [],
    [displayed]
  );

  useEffect(() => {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SIM_INPUT_KEY);
    if (!raw) return;

    const form = parseStoredForm(raw);
    const input = formToInput(form);
    try {
      validateLoanInput(input, formToStrategies(form));
    } catch {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      // Consome a chave dentro do timer: o double-mount do StrictMode (dev)
      // cancela o primeiro timer e re-executa o effect; sem isso o primeiro
      // efeito consumiria a chave e o segundo não salvaria nada.
      sessionStorage.removeItem(SIM_INPUT_KEY);
      setSaveState('saving');
      setSaveError('');
      try {
        const result = {
          price: simulate({ ...input, system: 'PRICE' }, EMPTY),
          sac: simulate({ ...input, system: 'SAC' }, EMPTY),
        };
        const res: SaveResult = await saveSimulation(input, EMPTY, result);
        if (cancelled) return;
        if ('error' in res) {
          setShowCreditsDialog(true);
          setSaveState('idle');
          return;
        }
        setSaveState('saved');
        router.refresh();
      } catch (e) {
        if (cancelled) return;
        setSaveError(e instanceof Error ? e.message : 'Erro ao salvar a simulação.');
        setSaveState('idle');
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!input || !base || !current || (compareSystems && !systemCompare) || !displayed) {
    return <div className="py-20 text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <UpgradeCard isUnlimited={isUnlimited} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{saved?.name ?? 'Simulador de financiamento'}</h1>
          <p className="text-sm text-muted-foreground">
            {input.system === 'PRICE' ? 'Sistema PRICE' : 'Sistema SAC'} · {formatBRL(input.principal)} ·{' '}
            {(input.annualRate * 100).toFixed(2)}% a.a. · {input.months} meses · {input.bank}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === 'saved' && (
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Simulação salva automaticamente
              </span>
              <Link href="/minhas-simulacoes" className="text-sm font-medium text-[#820AD1]">
                Ver minhas simulações →
              </Link>
            </span>
          )}
          {saveState === 'saving' && (
            <span className="text-sm text-muted-foreground">Salvando…</span>
          )}
          {saveError && <span className="text-sm text-destructive">{saveError}</span>}
          <ExportPdfButton result={displayed} isUnlimited={isUnlimited} />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/nova-simulacao" />}>
            Nova simulação
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-sm">
        {isUnlimited ? (
          <FieldHelp htmlFor="compareSystems" label="Comparar PRICE ↔ SAC" help="Mostra lado a lado como os mesmos valores evoluem em PRICE e SAC, sem alterar sua simulação principal.">
            <Switch
              id="compareSystems"
              data-field-help-id="compareSystems"
              aria-describedby="compareSystems-help"
              checked={compareSystems}
              onCheckedChange={(v) => {
                setCompareSystems(v);
                if (!v) setActiveSystem(null);
              }}
            />
          </FieldHelp>
        ) : (
          <>
            <span className="text-sm font-medium">Comparar PRICE ↔ SAC</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUpgradeOpen(true)}
            >
              <Lock className="size-3.5" /> Comparar PRICE × SAC: Exclusivo Ilimitado
            </Button>
          </>
        )}
      </div>

      <RecommendationCard base={base} best={recommendation?.best ?? base} />

      {compareSystems && systemCompare && (
        <div id="comparacao-sistemas" className="grid gap-3 sm:grid-cols-2">
          {(['PRICE', 'SAC'] as AmortSystem[]).map((system) => {
            const res = systemCompare[system];
            const isPrimary = primarySystem === system;
            return (
              <button
                key={system}
                type="button"
                onClick={() => setActiveSystem(system)}
                className={`flex flex-col gap-1 rounded-2xl border border-muted-foreground/40 bg-card p-4 text-left shadow-sm transition-colors ${
                  isPrimary ? 'ring-2 ring-[#820AD1] dark:ring-[#a44ce0]' : 'hover:ring-1 hover:ring-[#820AD1] dark:ring-[#a44ce0]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isPrimary ? 'text-[#820AD1]' : 'text-muted-foreground'}`}>
                    {system}{isPrimary && ' · principal'}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {formatBRL(res.metrics.totalPago)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Juros {formatBRL(res.metrics.totalJuros)} · Quita em {res.metrics.saldoZeroAt} meses
                </p>
              </button>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Métricas</h2>
        <MetricsGrid metrics={displayed.metrics} />
      </section>

      <DebtInsightCard
        input={input}
        result={displayed}
        isUnlimited={isUnlimited}
        onApplyAporte={(ratio) => applyAporteRef.current?.(ratio)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Gráficos</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <BalanceChart data={balanceData} />
          <InterestAmortChart installments={displayed.installments} />
          <div className="lg:col-span-2">
            <CompareChart base={baseSaldos} withStrategy={currentSaldos} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Tabela de parcelas</h2>
        <InstallmentTable installments={displayed.installments} />
      </section>

      <section className="flex flex-col gap-3">
        <StrategyControls
          input={input}
          strategies={strategies}
          onChange={(s) => {
            setCachedStrategies(clampStrategyUntilMonths(s, input.months));
            listeners.forEach((l) => l());
          }}
          base={base}
          current={displayed}
          onApplyAporteReady={registerApplyAporte}
        />
      </section>

      <ScenarioCompare input={input} base={base} current={displayed} />

      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créditos insuficientes</DialogTitle>
            <DialogDescription>
              Cada simulação completa custa 1 crédito e fica salva automaticamente por 6 horas.
              Adquira um pacote de créditos ou assine o plano para salvar sem limites.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
            <Button nativeButton={false} render={<Link href="/perfil" />}>
              Ver planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
