'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradeDialog } from '@/components/upgrade-dialog';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { computeComparator, type ComparatorResult } from '@/lib/comparator/calculate';
import { validateComparator } from '@/lib/comparator/validate';
import type { ComparatorInput } from '@/lib/comparator/types';
import { parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { ProposalCard } from './proposal-card';
import { ComparatorResultView } from './comparator-result';
import { SavedList } from './saved-list';
import { saveComparison, type ComparisonSummary } from './actions';

export interface RawProposal {
  id: string;
  bank: string;
  name: string;
  propertyValue: string;
  downPayment: string;
  principalManual: string;
  system: 'SAC' | 'PRICE';
  months: string;
  annualRate: string;
  cetInformed: string;
  trMonthly: string;
  insuranceMonthly: string;
  fees: { id: string; label: string; amount: string; includeInCet: boolean }[];
}

export interface RawFee {
  id: string;
  label: string;
  amount: string;
  includeInCet: boolean;
}

const NEW_PROPOSAL = (id: string): RawProposal => ({
  id,
  bank: '',
  name: '',
  propertyValue: '',
  downPayment: '',
  principalManual: '',
  system: 'SAC',
  months: '360',
  annualRate: '',
  cetInformed: '',
  trMonthly: '0.17',
  insuranceMonthly: '0',
  fees: [],
});

function rawToInput(proposals: RawProposal[], budget: string): ComparatorInput {
  return {
    monthlyBudget: parseBRLToNumber(budget),
    proposals: proposals.map((p) => ({
      id: p.id,
      bank: p.bank,
      name: p.name || undefined,
      propertyValue: parseBRLToNumber(p.propertyValue),
      downPayment: parseBRLToNumber(p.downPayment),
      principal: 0, // preenchido por normalizeProposal
      system: p.system,
      months: Number(p.months),
      annualRate: parseDecimal(p.annualRate) / 100,
      cetInformed: parseDecimal(p.cetInformed) / 100,
      trMonthly: parseDecimal(p.trMonthly) / 100,
      insuranceMonthly: parseBRLToNumber(p.insuranceMonthly),
      fees: p.fees.map((f) => ({
        id: f.id,
        label: f.label,
        amount: parseBRLToNumber(f.amount),
        includeInCet: f.includeInCet,
      })),
    })),
  };
}

export function ComparatorClient({
  locked,
  initialComparisons,
  saved,
}: {
  locked: boolean;
  initialComparisons: ComparisonSummary[];
  saved: { input: ComparatorInput; result: ComparatorResult; name: string; engineVersion: string } | null;
}) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [proposals, setProposals] = useState<RawProposal[]>(() => {
    if (saved) {
      return saved.input.proposals.map((p) => ({
        id: p.id,
        bank: p.bank,
        name: p.name ?? '',
        propertyValue: String(Math.round(p.propertyValue)),
        downPayment: String(Math.round(p.downPayment)),
        principalManual: String(Math.round(p.principal)),
        system: p.system,
        months: String(p.months),
        annualRate: String((p.annualRate * 100).toFixed(2)),
        cetInformed: String((p.cetInformed * 100).toFixed(2)),
        trMonthly: String((p.trMonthly * 100).toFixed(2)),
        insuranceMonthly: String(Math.round(p.insuranceMonthly)),
        fees: p.fees.map((f) => ({ id: f.id, label: f.label, amount: String(f.amount), includeInCet: f.includeInCet })),
      }));
    }
    return [NEW_PROPOSAL('p1'), NEW_PROPOSAL('p2')];
  });
  const [budget, setBudget] = useState<string>(() => (saved ? String(Math.round(saved.input.monthlyBudget)) : '12000'));
  const [result, setResult] = useState<ComparatorResult | null>(saved?.result ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const set = (id: string, patch: Partial<RawProposal>) =>
    setProposals((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  if (locked) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 bg-muted p-6">
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              Comparar propostas <Sparkles className="size-5 text-[#820AD1]" />
            </CardTitle>
            <CardDescription>
              Compare até 3 propostas bancárias, audite o CET e descubra quanto o amortizador inteligente pode economizar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Recurso exclusivo do plano Ilimitado.</p>
            <Button type="button" onClick={() => setUpgradeOpen(true)}>
              Ver opções de acesso
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </div>
    );
  }

  const input = useMemo(() => rawToInput(proposals, budget), [proposals, budget]);

  function comparar() {
    setErrors({});
    setGlobalError('');
    setSaveMsg('');
    const errs = validateComparator(input);
    if (errs.length) {
      setGlobalError('Corrija os erros abaixo para comparar.');
      setErrors(Object.fromEntries(errs.map((e) => [e.id, e.message])));
      return;
    }
    setResult(computeComparator(input));
  }

  async function salvar() {
    if (!result) return;
    const res = await saveComparison(input, proposals.map((p) => p.bank).filter(Boolean).join(' vs '));
    if ('error' in res) {
      setSaveMsg(res.error);
      return;
    }
    setSaveMsg('Comparação salva.');
    router.refresh();
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Comparar propostas</h1>
        <p className="text-sm text-muted-foreground">
          Até 3 propostas bancárias lado a lado. Exclusivo do plano Ilimitado.
        </p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget">Quanto consegue pagar por mês (R$)</Label>
            <MoneyInput id="budget" value={parseBRLToNumber(budget)} onValid={(v) => setBudget(String(v))} />
          </div>
          {globalError && <p className="text-sm text-destructive">{globalError}</p>}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {proposals.map((p) => (
              <ProposalCard key={p.id} raw={p} error={errors[p.id]} onChange={(patch) => set(p.id, patch)} />
            ))}
          </div>
          {proposals.length < 3 && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => setProposals((ps) => [...ps, NEW_PROPOSAL(`p${ps.length + 1}`)])}
            >
              <Plus className="size-4" /> Adicionar terceira proposta
            </Button>
          )}
          <Button type="button" className="w-fit" onClick={comparar}>
            Comparar propostas
          </Button>
          {saveMsg && <p className="text-sm text-muted-foreground">{saveMsg}</p>}
        </CardContent>
      </Card>

      {result && <ComparatorResultView result={result} input={input} onSave={salvar} />}

      <SavedList initial={initialComparisons} />
    </div>
  );
}
