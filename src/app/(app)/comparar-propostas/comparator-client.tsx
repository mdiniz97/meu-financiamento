'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/money-input';
import { FieldHelp } from '@/components/ui/field-help';
import { computeComparator, type ComparatorResult } from '@/lib/comparator/calculate';
import { validateComparator } from '@/lib/comparator/validate';
import type { ComparatorInput } from '@/lib/comparator/types';
import { numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { ProposalCard } from './proposal-card';
import { normalizeRate, type RateKind } from '@/lib/finance/rates';
import { ComparatorResultView } from './comparator-result';
import { saveComparison } from './actions';
import { nextProposalId } from './proposal-id';

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
  annualRateKind: RateKind;
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

const NUMERIC_FIELD_LABELS: Record<string, string> = {
  months: 'Prazo',
  annualRate: 'Taxa contratual',
  cetInformed: 'CET',
  trMonthly: 'TR mensal',
  principal: 'Valor financiado',
};

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
  annualRateKind: 'effective-annual',
  cetInformed: '',
  trMonthly: '0.17',
  insuranceMonthly: '0',
  fees: [],
});

function effectiveAnnualRate(value: string, kind: RateKind) {
  try {
    return normalizeRate(parseDecimal(value), kind).effectiveAnnual;
  } catch {
    return NaN;
  }
}

function proposalToRaw(p: ComparatorInput['proposals'][number]): RawProposal {
  return {
    id: p.id,
    bank: p.bank,
    name: p.name ?? '',
    propertyValue: String(Math.round(p.propertyValue)),
    downPayment: String(Math.round(p.downPayment)),
    principalManual:
      p.principalManual ? String(Math.round(p.principal)) : '',
    system: p.system,
    months: String(p.months),
    annualRate: String(p.annualRateValue ?? p.annualRate * 100),
    annualRateKind: p.annualRateKind ?? 'effective-annual',
    cetInformed: String(p.cetInformed * 100),
    trMonthly: String(p.trMonthly * 100),
    insuranceMonthly: String(Math.round(p.insuranceMonthly)),
    fees: p.fees.map((f) => ({ id: f.id, label: f.label, amount: String(f.amount), includeInCet: f.includeInCet })),
  };
}

function rawToInput(proposals: RawProposal[], budget: string): ComparatorInput {
  return {
    monthlyBudget: parseBRLToNumber(budget),
    proposals: proposals.map((p) => ({
      id: p.id,
      bank: p.bank,
      name: p.name || undefined,
      propertyValue: parseBRLToNumber(p.propertyValue),
      downPayment: parseBRLToNumber(p.downPayment),
      principal: p.principalManual === ''
        ? parseBRLToNumber(p.propertyValue) - parseBRLToNumber(p.downPayment)
        : parseBRLToNumber(p.principalManual),
      principalManual: p.principalManual !== '',
      system: p.system,
      months: Number(p.months),
      annualRate: effectiveAnnualRate(p.annualRate, p.annualRateKind),
      annualRateValue: parseDecimal(p.annualRate),
      annualRateKind: p.annualRateKind,
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
  saved,
}: {
  saved: { input: ComparatorInput; result: ComparatorResult; name: string; resultEngineVersion: string; storedEngineVersion: string; recalculated: boolean } | null;
}) {
  const [proposals, setProposals] = useState<RawProposal[]>(() => {
    if (saved) {
      return saved.input.proposals.map(proposalToRaw);
    }
    return [NEW_PROPOSAL('p1'), NEW_PROPOSAL('p2')];
  });
  const [budget, setBudget] = useState<string>(() => (saved ? String(Math.round(saved.input.monthlyBudget)) : '12000'));
  const [result, setResult] = useState<ComparatorResult | null>(saved?.result ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const invalidFieldsRef = useRef<Record<string, boolean>>({});
  const currentSavedRef = useRef(saved);

  // navegação client-side para ?id=X preserva a instância: useEffect repopula
  useEffect(() => {
    if (saved && saved !== currentSavedRef.current) {
      currentSavedRef.current = saved;
      const savedProposals = saved.input.proposals.map(proposalToRaw);
      // `saved` muda após navegação client-side; formulário local deve acompanhar o registro aberto.
      setProposals(savedProposals);
      setBudget(String(Math.round(saved.input.monthlyBudget)));
      setResult(saved.result);
      setErrors({});
      setGlobalError('');
      setSaveMsg('');
      invalidFieldsRef.current = {};
      setInvalidFields({});
    }
  }, [saved]);

  const set = (id: string, patch: Partial<RawProposal>) => {
    setResult(null);
    setSaveMsg('');
    setProposals((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const input = useMemo(() => rawToInput(proposals, budget), [proposals, budget]);

  // Auto-save: cada comparação válida é salva automaticamente uma vez por input.
  // A sessionStorage guarda o fingerprint do último input salvo para não duplicar
  // em reload; um novo cálculo (input diferente) salva de novo.
  const savedFpRef = useRef<string | null>(null);
  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  useEffect(() => {
    if (!result) return;
    if (savedFpRef.current === null) {
      savedFpRef.current =
        typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('comparison-saved-fp');
    }
    const fp = JSON.stringify(input);
    if (savedFpRef.current === fp) return;
    savedFpRef.current = fp;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('comparison-saved-fp', fp);
    }
    (async () => {
      const res = await saveComparison(
        input,
        proposals.map((p) => p.bank).filter(Boolean).join(' vs ')
      );
      if (resultRef.current !== result) return;
      if ('error' in res) {
        setSaveMsg(res.error);
        return;
      }
      setSaveMsg('Comparação salva automaticamente.');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);


  function comparar() {
    setResult(null);
    setErrors({});
    setGlobalError('');
    setSaveMsg('');
    const invalidProposalIds = proposals.filter((proposal) =>
      Object.keys(invalidFieldsRef.current).some((key) => key.startsWith(`${proposal.id}:`))
    ).map((proposal) => proposal.id);
    if (invalidProposalIds.length) {
      setResult(null);
      setGlobalError('Corrija os erros abaixo para comparar.');
      setErrors(Object.fromEntries(invalidProposalIds.map((id) => {
        const labels = Object.keys(invalidFieldsRef.current)
          .filter((key) => key.startsWith(`${id}:`))
          .map((key) => NUMERIC_FIELD_LABELS[key.split(':')[1]] ?? 'Campo numérico');
        return [id, `${labels.join(', ')}: informe um número válido.`];
      })));
      return;
    }
    const errs = validateComparator(input);
    if (errs.length) {
      setGlobalError('Corrija os erros abaixo para comparar.');
      setErrors(Object.fromEntries(errs.map((e) => [e.id, e.message])));
      return;
    }
    setResult(computeComparator(input));
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold">Comparar propostas</h1>
        <p className="text-sm text-muted-foreground">
          Até 3 propostas bancárias lado a lado. Exclusivo do plano Ilimitado.
        </p>
      </div>
      {saved?.recalculated && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          Comparação salva na versão {saved.storedEngineVersion} recalculada com a versão {saved.resultEngineVersion} para manter formulário e resultado consistentes.
        </p>
      )}

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6">
          <FieldHelp htmlFor="budget" label="Quanto consegue pagar por mês (R$)" help="Seu teto mensal para comparar se a prestação inicial de cada proposta cabe no orçamento.">
            <MoneyInput id="budget" aria-describedby="budget-help" value={parseBRLToNumber(budget)} onValid={(v) => { setResult(null); setSaveMsg(''); setBudget(numberToBRLInput(v)); }} />
          </FieldHelp>
          {globalError && <p className="text-sm text-destructive">{globalError}</p>}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                raw={p}
                error={errors[p.id]}
                canRemove={proposals.length > 2}
                onChange={(patch) => set(p.id, patch)}
                onFieldValidityChange={(field, valid) => {
                  const key = `${p.id}:${field}`;
                  const next = { ...invalidFieldsRef.current };
                  if (valid) delete next[key];
                  else next[key] = true;
                  invalidFieldsRef.current = next;
                  setInvalidFields(next);
                  if (!valid) {
                    setResult(null);
                    setSaveMsg('');
                    setGlobalError('Corrija os campos numéricos inválidos para comparar.');
                    setErrors((current) => ({ ...current, [p.id]: `${NUMERIC_FIELD_LABELS[field]}: informe um número válido.` }));
                  } else if (!Object.keys(next).some((invalidKey) => invalidKey.startsWith(`${p.id}:`))) {
                    setErrors((current) => {
                      const updated = { ...current };
                      delete updated[p.id];
                      return updated;
                    });
                    if (Object.keys(next).length === 0) setGlobalError('');
                  }
                }}
                onRemove={() => {
                  const prefix = `${p.id}:`;
                  const nextInvalidFields = Object.fromEntries(
                    Object.entries(invalidFieldsRef.current).filter(([key]) => !key.startsWith(prefix))
                  );
                  invalidFieldsRef.current = nextInvalidFields;
                  setInvalidFields(nextInvalidFields);
                  setProposals((ps) => ps.filter((x) => x.id !== p.id));
                  setResult(null);
                  setSaveMsg('');
                  setErrors((current) => {
                    const updated = { ...current };
                    delete updated[p.id];
                    return updated;
                  });
                  if (Object.keys(nextInvalidFields).length === 0) setGlobalError('');
                }}
              />
            ))}
          </div>
          {proposals.length < 3 && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setResult(null);
                setSaveMsg('');
                const id = nextProposalId(proposals);
                if (!id) return;
                setProposals((ps) => [...ps, NEW_PROPOSAL(id)]);
              }}
            >
              <Plus className="size-4" /> Adicionar terceira proposta
            </Button>
          )}
          <Button type="button" className="w-fit" onClick={comparar} disabled={Object.keys(invalidFields).length > 0}>
            Comparar propostas
          </Button>
          {saveMsg && <p className="text-sm text-muted-foreground">{saveMsg}</p>}
        </CardContent>
      </Card>

      {result && (

          <ComparatorResultView result={result} input={input} />
      )}
    </div>
  );
}
