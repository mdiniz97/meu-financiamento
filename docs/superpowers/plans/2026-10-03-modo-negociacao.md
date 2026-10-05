# Modo Negociação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova ferramenta `/negociacao` (exclusiva Ilimitado) que diz se uma proposta cabe no teto de parcela, calcula os limites de negociação (taxa máx, entrada mínima, prazo mínimo) e gera um script, salvando/comparando ofertas.

**Architecture:** Motor puro `negotiation.ts` sobre o engine existente (`simulate`/`calculatePeakPayment`/`calculateFinancingCapacity`). Client component reusa os inputs de formulário do app. Persistência reusa `saveToolSimulation` (`system: 'negociacao'`, sem migração).

**Tech Stack:** Next.js 16 (App Router, server actions), Drizzle/Postgres, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-03-modo-negociacao-design.md`

## Global Constraints

- Ferramenta exclusiva do **Ilimitado** (UpgradeCard p/ quem não assina), como as demais ferramentas.
- Critério único: **pico de parcela ≤ teto** (não só a 1ª parcela), com SAC/PRICE, TR e seguro.
- Nada de nova migração: persistência via `simulations` (`system = 'negociacao'`, `charge: false`).
- Preço/valores nunca vêm da URL; allowlist `system` PRICE/SAC.
- Testes financeiros só com dados locais; sem cobrança real.

## Review Focus

1. Teto ≤ seguro mensal: veredito "não fecha", `maxAnnualRate = null`, limites coerentes (não infinito/NaN).
2. Taxa/prazo fora da faixa: mensagem de validação, sem cálculo.
3. Entrada/valor: `minDownPayment` nunca negativo; `maxPropertyValue` coerente com a entrada atual.
4. `fits` no limite exato (pico == teto) não deve piscar para "não cabe" por centavo.
5. Salvar sem consumir crédito e a lista não vazar dados de outro usuário.

---

### Task 1: Motor de negociação (puro)

**Files:**
- Create: `src/lib/finance/negotiation.ts`
- Test: `src/lib/finance/negotiation.test.ts`

**Interfaces:**
- Consumes: `calculatePeakPayment`, `calculateFinancingCapacity` de `./financing-capacity`; `AmortSystem` de `./types`.
- Produces: `evaluateNegotiation(input: NegotiationInput): NegotiationResult`; tipos `NegotiationInput`, `NegotiationResult`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateNegotiation } from './negotiation';

const base = {
  system: 'PRICE' as const,
  principal: 300000,
  propertyValue: 400000,
  annualRate: 0.10,
  months: 360,
  trMonthly: 0,
  insuranceMonthly: 0,
  bank: 'Caixa',
  maxPayment: 3000,
};

const peakOf = (rate: number, months: number) =>
  evaluateNegotiation({ ...base, annualRate: rate, months }).peakPayment;

describe('evaluateNegotiation', () => {
  it('marca fits e folga quando o pico cabe no teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.fits).toBe(true);
    expect(r.peakPayment).toBeLessThanOrEqual(base.maxPayment + 0.01);
    expect(r.slackMonthly).toBeCloseTo(base.maxPayment - r.peakPayment, 2);
  });
  it('fits=false e slack 0 quando o pico estoura', () => {
    const r = evaluateNegotiation({ ...base, maxPayment: 1000 });
    expect(r.fits).toBe(false);
    expect(r.slackMonthly).toBe(0);
    expect(r.maxAnnualRate).toBeNull();
  });
  it('maxAnnualRate é a maior taxa em que o pico ~ teto', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxAnnualRate).not.toBeNull();
    expect(peakOf(r.maxAnnualRate!, base.months)).toBeLessThanOrEqual(base.maxPayment + 0.5);
    expect(peakOf(r.maxAnnualRate! + 0.001, base.months)).toBeGreaterThan(base.maxPayment);
  });
  it('minMonths é o menor prazo em que o pico cabe', () => {
    const r = evaluateNegotiation(base);
    expect(peakOf(base.annualRate, r.minMonths)).toBeLessThanOrEqual(base.maxPayment + 0.01);
    if (r.minMonths > 1) {
      expect(peakOf(base.annualRate, r.minMonths - 1)).toBeGreaterThan(base.maxPayment);
    }
  });
  it('maxPrincipal tem pico <= teto e minDownPayment = valor - maxPrincipal', () => {
    const r = evaluateNegotiation(base);
    expect(r.maxPrincipal).toBeGreaterThan(0);
    expect(r.minDownPayment).toBeCloseTo(base.propertyValue - r.maxPrincipal, 2);
    expect(r.maxPropertyValue).toBeCloseTo(r.maxPrincipal + (base.propertyValue - base.principal), 2);
  });
  it('SAC e PRICE retornam limites coerentes (sem NaN/infinito)', () => {
    for (const system of ['PRICE', 'SAC'] as const) {
      const r = evaluateNegotiation({ ...base, system });
      expect(Number.isFinite(r.peakPayment)).toBe(true);
      expect(Number.isFinite(r.maxPrincipal)).toBe(true);
      expect(r.minDownPayment).toBeGreaterThanOrEqual(0);
    }
  });
  it('lança erro para entrada inválida', () => {
    expect(() => evaluateNegotiation({ ...base, months: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finance/negotiation.test.ts`
Expected: FAIL — `Cannot find module './negotiation'`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { calculateFinancingCapacity, calculatePeakPayment } from './financing-capacity';
import type { AmortSystem } from './types';

export interface NegotiationInput {
  system: AmortSystem;
  principal: number;
  propertyValue: number;
  annualRate: number; // taxa efetiva anual (0.10 = 10%)
  months: number;
  trMonthly: number;
  insuranceMonthly: number;
  bank: string;
  maxPayment: number; // teto de parcela
}

export interface NegotiationResult {
  fits: boolean;
  initialPayment: number;
  peakPayment: number;
  peakPaymentMonth: number;
  slackMonthly: number;
  maxAnnualRate: number | null;
  minMonths: number;
  maxPrincipal: number;
  minDownPayment: number;
  maxPropertyValue: number;
}

const MAX_RATE = 1; // 100% a.a.
const MAX_MONTHS = 600;
const RATE_ITERATIONS = 60;
const MONTH_ITERATIONS = 40;

function peakAt(input: NegotiationInput, rate: number, months: number) {
  return calculatePeakPayment(
    {
      maxPayment: Number.POSITIVE_INFINITY,
      annualRate: rate,
      trMonthly: input.trMonthly,
      insuranceMonthly: input.insuranceMonthly,
      bank: input.bank,
      months,
    },
    input.principal,
    input.system
  );
}

function validate(input: NegotiationInput): void {
  const finite = (n: number) => Number.isFinite(n);
  const ok =
    (input.system === 'PRICE' || input.system === 'SAC') &&
    finite(input.principal) && input.principal >= 0 &&
    finite(input.propertyValue) && input.propertyValue >= 0 &&
    finite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= MAX_RATE &&
    Number.isInteger(input.months) && input.months >= 1 && input.months <= MAX_MONTHS &&
    finite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1 &&
    finite(input.insuranceMonthly) && input.insuranceMonthly >= 0 &&
    typeof input.bank === 'string' && input.bank.trim().length > 0 && input.bank.length <= 60 &&
    finite(input.maxPayment) && input.maxPayment > 0;
  if (!ok) throw new Error('Input inválido para negociação.');
}

export function evaluateNegotiation(input: NegotiationInput): NegotiationResult {
  validate(input);
  const teto = input.maxPayment;

  const current = peakAt(input, input.annualRate, input.months);
  const fits = current.peakPayment <= teto + 0.01;

  // maior taxa que ainda cabe
  let maxAnnualRate: number | null;
  if (peakAt(input, 0, input.months).peakPayment > teto) {
    maxAnnualRate = null;
  } else if (peakAt(input, MAX_RATE, input.months).peakPayment <= teto) {
    maxAnnualRate = MAX_RATE;
  } else {
    let lo = 0;
    let hi = MAX_RATE;
    for (let i = 0; i < RATE_ITERATIONS && hi - lo > 1e-6; i++) {
      const mid = (lo + hi) / 2;
      if (peakAt(input, mid, input.months).peakPayment <= teto) lo = mid;
      else hi = mid;
    }
    maxAnnualRate = Math.floor(lo * 1e6) / 1e6;
  }

  // menor prazo que ainda cabe (prazo maior sempre cabe mais)
  let minMonths: number;
  if (peakAt(input, input.annualRate, MAX_MONTHS).peakPayment > teto) {
    minMonths = MAX_MONTHS;
  } else {
    let lo = 1;
    let hi = MAX_MONTHS;
    for (let i = 0; i < MONTH_ITERATIONS && lo < hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      if (peakAt(input, input.annualRate, mid).peakPayment <= teto) hi = mid;
      else lo = mid + 1;
    }
    minMonths = lo;
  }

  const capacity = calculateFinancingCapacity({
    maxPayment: teto,
    annualRate: input.annualRate,
    trMonthly: input.trMonthly,
    insuranceMonthly: input.insuranceMonthly,
    bank: input.bank,
    months: input.months,
  });
  const maxPrincipal = Math.max(0, capacity[input.system].safeLimit);
  const currentDownPayment = Math.max(0, input.propertyValue - input.principal);
  const minDownPayment = Math.max(0, input.propertyValue - maxPrincipal);
  const maxPropertyValue = maxPrincipal + currentDownPayment;

  return {
    fits,
    initialPayment: current.initialPayment,
    peakPayment: current.peakPayment,
    peakPaymentMonth: current.peakPaymentMonth,
    slackMonthly: fits ? Math.max(0, teto - current.peakPayment) : 0,
    maxAnnualRate,
    minMonths,
    maxPrincipal,
    minDownPayment,
    maxPropertyValue,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finance/negotiation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/negotiation.ts src/lib/finance/negotiation.test.ts
git commit -m "feat(negotiation): pure negotiation engine"
```

---

### Task 2: Ação de listar negociações salvas

**Files:**
- Create: `src/app/(app)/negociacao/actions.ts`
- Test: `src/app/(app)/negociacao/actions.test.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `auth`.
- Produces: `listNegotiations(): Promise<SavedNegotiation[]>` com `SavedNegotiation = { id: string; name: string; payload: unknown; result: unknown; createdAt: Date }`.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({
  db: { query: { simulations: { findMany: m.findMany } } },
  schema: { simulations: { userId: 'simulations.user_id', system: 'simulations.system' } },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, desc: (c: unknown) => c }));

import { listNegotiations } from './actions';

beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ userId: 'u1' }); m.findMany.mockResolvedValue([{ id: 'n1', name: 'Caixa', payload: {}, result: {}, createdAt: new Date() }]); });

describe('listNegotiations', () => {
  it('retorna as negociações do usuário', async () => {
    const rows = await listNegotiations();
    expect(rows).toHaveLength(1);
    expect(m.findMany).toHaveBeenCalled();
  });
  it('retorna vazio sem sessão', async () => {
    m.auth.mockResolvedValue(null);
    expect(await listNegotiations()).toEqual([]);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/(app)/negociacao/actions.test.ts`
Expected: FAIL — `Cannot find module './actions'`.

- [ ] **Step 3: Write minimal implementation**

```ts
'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';

export interface SavedNegotiation {
  id: string;
  name: string;
  payload: unknown;
  result: unknown;
  createdAt: Date;
}

export async function listNegotiations(): Promise<SavedNegotiation[]> {
  const session = await auth();
  if (!session?.userId) return [];
  const rows = await db.query.simulations.findMany({
    where: and(
      eq(schema.simulations.userId, session.userId),
      eq(schema.simulations.system, 'negociacao')
    ),
  });
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20)
    .map((r) => ({ id: r.id, name: r.name, payload: r.payload, result: r.result, createdAt: r.createdAt }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/(app)/negociacao/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/negociacao/actions.ts" "src/app/(app)/negociacao/actions.test.ts"
git commit -m "feat(negotiation): list saved negotiations"
```

---

### Task 3: Componente cliente da mesa de negociação

**Files:**
- Create: `src/components/simulation/NegotiationCalculator.tsx`
- Test: covered by Task 5 (e2e).

**Interfaces:**
- Consumes: `evaluateNegotiation` (Task 1); `saveToolSimulation` de `@/app/(app)/simulacao/actions`; `listNegotiations` (Task 2); `MoneyInput`, `NumericInput`, `RateField`, `parseIntStrict` de `./form-inputs`; `BANKS` de `@/lib/simulation-context`; `formatBRL`, `numberToBRLInput`, `parseBRLToNumber`, `parseDecimal` de `@/lib/utils`.
- Produces: `NegotiationCalculator` (client component, sem props).

- [ ] **Step 1: Write the component**

Estrutura: estado do formulário (valores em string, como os outros calculators), um `useMemo` que converte para `NegotiationInput` e chama `evaluateNegotiation` (com try/catch → mensagem de erro), painéis: **Veredito** (semáforo), **Limites** (taxa máx, entrada mínima, prazo mínimo, principal/valor máx), **Script**, botão **Salvar oferta** (chama `saveToolSimulation` com `system: 'negociacao'`, `charge: false`), e lista das ofertas salvas com comparação lado a lado.

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Handshake } from 'lucide-react';
import { BANKS } from '@/lib/simulation-context';
import { formatBRL, numberToBRLInput, parseBRLToNumber, parseDecimal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldHelp } from '@/components/ui/field-help';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput, NumericInput, parseIntStrict, RateField } from './form-inputs';
import { evaluateNegotiation, type NegotiationResult } from '@/lib/finance/negotiation';
import { saveToolSimulation } from '@/app/(app)/simulacao/actions';
import { listNegotiations, type SavedNegotiation } from '@/app/(app)/negociacao/actions';
import type { AmortSystem } from '@/lib/finance/types';

interface Form {
  system: AmortSystem;
  principal: string;
  propertyValue: string;
  annualRate: string;
  months: string;
  trMonthly: string;
  insuranceMonthly: string;
  bank: string;
  maxPayment: string;
}

const DEFAULTS: Form = {
  system: 'PRICE', principal: '', propertyValue: '', annualRate: '', months: '',
  trMonthly: '', insuranceMonthly: '', bank: '', maxPayment: '',
};

export function NegotiationCalculator() {
  const [f, setF] = useState<Form>(DEFAULTS);
  const [rateValid, setRateValid] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [saved, setSaved] = useState<SavedNegotiation[]>([]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const refresh = useCallback(async () => setSaved(await listNegotiations()), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const { result, error } = useMemo<{ result: NegotiationResult | null; error: string }>(() => {
    const principal = parseBRLToNumber(f.principal);
    const propertyValue = parseBRLToNumber(f.propertyValue);
    const annualRate = parseDecimal(f.annualRate) / 100;
    const months = Number(f.months);
    const maxPayment = parseBRLToNumber(f.maxPayment);
    if (!(principal > 0 && propertyValue > 0 && months >= 1 && maxPayment > 0 && f.annualRate.trim() && rateValid && f.bank)) {
      return { result: null, error: '' };
    }
    try {
      return {
        result: evaluateNegotiation({
          system: f.system,
          principal,
          propertyValue,
          annualRate,
          months,
          trMonthly: parseDecimal(f.trMonthly) / 100,
          insuranceMonthly: parseBRLToNumber(f.insuranceMonthly),
          bank: f.bank,
          maxPayment,
        }),
        error: '',
      };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : 'Dados inválidos.' };
    }
  }, [f, rateValid]);

  async function save() {
    if (!result) return;
    setSaveMsg('');
    const name = f.bank ? `Negociação ${f.bank}` : 'Negociação';
    const res = await saveToolSimulation({ name, system: 'negociacao', payload: f, result, charge: false });
    if ('error' in res) { setSaveMsg(res.error); return; }
    setSaveMsg('Oferta salva.');
    await refresh();
  }

  const fmtRate = (rate: number) => `${(rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.`;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-xl">
            <Handshake className="size-5 text-[#820AD1]" /> Mesa de negociação
          </CardTitle>
          <CardDescription>Informe a proposta e o teto de parcela: veja se fecha e onde apertar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FieldHelp htmlFor="ngPrincipal" label="Valor financiado (R$)" help="Quanto o banco empresta (preço do imóvel menos a entrada).">
            <MoneyInput id="ngPrincipal" value={parseBRLToNumber(f.principal)} onValid={(v) => set('principal', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngProperty" label="Valor do imóvel (R$)" help="Preço total do imóvel; usado para calcular a entrada mínima.">
            <MoneyInput id="ngProperty" value={parseBRLToNumber(f.propertyValue)} onValid={(v) => set('propertyValue', numberToBRLInput(v))} />
          </FieldHelp>
          <RateField id="ngRate" label="Taxa de juros" value={parseDecimal(f.annualRate)} kind="effective-annual" minEffectiveAnnual={0} onValueChange={(v) => set('annualRate', String(v))} onValidityChange={setRateValid} onKindChange={() => undefined} />
          <FieldHelp htmlFor="ngMonths" label="Prazo (meses)" help="Número de parcelas da proposta.">
            <NumericInput id="ngMonths" value={Number(f.months)} parse={parseIntStrict} onValid={(v) => set('months', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngTr" label="TR mensal (%)" help="Correção monetária mensal; use 0 se não houver.">
            <NumericInput id="ngTr" value={parseDecimal(f.trMonthly)} parse={parseDecimal} onValid={(v) => set('trMonthly', String(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngIns" label="Seguro (R$/mês)" help="Seguro mensal (MIP+DFI) informado pelo banco.">
            <MoneyInput id="ngIns" value={parseBRLToNumber(f.insuranceMonthly)} onValid={(v) => set('insuranceMonthly', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngBank" label="Banco" help="Instituição da proposta.">
            <Select value={f.bank} onValueChange={(b) => set('bank', String(b))}>
              <SelectTrigger id="ngBank" className="w-full" size="sm"><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </FieldHelp>
          <FieldHelp htmlFor="ngTeto" label="Teto de parcela (R$)" help="O máximo que cabe no seu orçamento por mês.">
            <MoneyInput id="ngTeto" value={parseBRLToNumber(f.maxPayment)} onValid={(v) => set('maxPayment', numberToBRLInput(v))} />
          </FieldHelp>
          <FieldHelp htmlFor="ngSystem" label="Sistema" help="PRICE mantém a parcela estável; SAC começa maior e cai.">
            <RadioGroup id="ngSystem" aria-label="Sistema" value={f.system} onValueChange={(s) => set('system', s as AmortSystem)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="PRICE" /> PRICE</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="SAC" /> SAC</label>
            </RadioGroup>
          </FieldHelp>
          {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {result.fits
                ? (result.slackMonthly < 50 ? 'No limite — fecha apertado' : 'Fecha no seu orçamento')
                : 'Não fecha com esse teto'}
            </CardTitle>
            <CardDescription>
              Parcela inicial {formatBRL(result.initialPayment)} · pico {formatBRL(result.peakPayment)} no mês {result.peakPaymentMonth} · folga {formatBRL(result.slackMonthly)}/mês
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-xs text-muted-foreground">Taxa máxima</span><p className="font-semibold">{result.maxAnnualRate === null ? 'Nem a 0% cabe' : fmtRate(result.maxAnnualRate)}</p></div>
            <div><span className="text-xs text-muted-foreground">Entrada mínima</span><p className="font-semibold">{formatBRL(result.minDownPayment)}</p></div>
            <div><span className="text-xs text-muted-foreground">Prazo mínimo viável</span><p className="font-semibold">{result.minMonths} meses</p></div>
            <div><span className="text-xs text-muted-foreground">Financia no máximo</span><p className="font-semibold">{formatBRL(result.maxPrincipal)}</p></div>
            <div><span className="text-xs text-muted-foreground">Imóvel que cabe</span><p className="font-semibold">{formatBRL(result.maxPropertyValue)}</p></div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base">Script para a conversa</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              {result.fits
                ? `Fecha no teto de ${formatBRL(parseBRLToNumber(f.maxPayment))}. `
                : `Com o teto de ${formatBRL(parseBRLToNumber(f.maxPayment))} não fecha. `}
              {result.maxAnnualRate !== null
                ? `Peça taxa ≤ ${fmtRate(result.maxAnnualRate)}`
                : 'Nenhuma taxa faz caber'}
              {' '}ou entrada ≥ {formatBRL(result.minDownPayment)}; prazo mínimo viável {result.minMonths} meses.
            </p>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={save}>Salvar oferta</Button>
              {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {saved.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-base">Ofertas salvas</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-mono tabular-nums">{formatBRL((parseBRLToNumber((s.payload as Form).maxPayment)))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/simulation/NegotiationCalculator.tsx
git commit -m "feat(negotiation): calculator UI with live verdict and script"
```

---

### Task 4: Página `/negociacao` e navegação

**Files:**
- Create: `src/app/(app)/negociacao/page.tsx`
- Modify: `src/components/app-sidebar.tsx` (adicionar item)
- Test: covered by Task 5 (e2e).

**Interfaces:**
- Consumes: `NegotiationCalculator` (Task 3), `UpgradeCard`, `ExclusiveCard`, `auth`, `getCreditBalance`, `loginHref`.
- Produces: rota `/negociacao`.

- [ ] **Step 1: Página (gating igual meta-de-quitacao)**

```tsx
import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Handshake } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExclusiveCard } from '@/components/exclusive-card';
import { UpgradeCard } from '@/components/upgrade-card';
import { NegotiationCalculator } from '@/components/simulation/NegotiationCalculator';

export default async function NegociacaoPage() {
  const session = await auth();
  if (!session?.userId) redirect(loginHref('/negociacao'));
  const { isUnlimited } = await getCreditBalance(session.userId);

  return (
    <div className="flex w-full flex-1 justify-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {isUnlimited ? (
          <NegotiationCalculator />
        ) : (
          <>
            <UpgradeCard />
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle role="heading" aria-level={1} className="font-display flex items-center gap-2 text-xl">
                  <Handshake className="size-5 text-[#820AD1]" /> Mesa de negociação
                </CardTitle>
                <CardDescription>Descubra o teto da taxa, a entrada mínima e o prazo mínimo antes de fechar com o banco.</CardDescription>
              </CardHeader>
              <CardContent>
                <ExclusiveCard isUnlimited={false} benefit="Negocie com números: taxa máxima, entrada mínima e prazo mínimo para a proposta caber no seu orçamento." />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar**

Em `src/components/app-sidebar.tsx`, adicionar `Handshake` ao import do `lucide-react` e, na lista de ferramentas, logo após Portabilidade:

```tsx
{ href: '/negociacao', label: 'Mesa de negociação', icon: Handshake },
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/negociacao/page.tsx" src/components/app-sidebar.tsx src/components/simulation/NegotiationCalculator.tsx`
Expected: sem erros/avisos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/negociacao/page.tsx" src/components/app-sidebar.tsx
git commit -m "feat(negotiation): /negociacao route and sidebar entry"
```

---

### Task 5: E2E do fluxo

**Files:**
- Create: `e2e/negotiation.spec.ts`

**Interfaces:**
- Consumes: rota `/negociacao`, `NegotiationCalculator`, DB isolado.

- [ ] **Step 1: Escrever o e2e**

Padrão do `e2e/subscribe-direct.spec.ts`: cria usuário, dá Ilimitado (provider `fake`), login e navega. Sem `networkidle`.

```ts
import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } });
}
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
test.skip(url?.hostname !== 'localhost' || url.pathname !== '/financiamento_trial_test', 'isolated database required');

async function loginWithUnlimited(page: import('@playwright/test').Page) {
  const email = `nego-${crypto.randomUUID()}@example.test`;
  const [user] = await db.insert(schema.users).values({ name: 'T', email, passwordHash: await bcrypt.hash('senhaTeste123', 10) }).returning();
  await db.insert(schema.packs).values({ id: 'unlimited', name: 'Ilimitado', priceCents: 11990, isSubscription: true }).onConflictDoNothing();
  await db.insert(schema.subscriptions).values({ userId: user.id, provider: 'fake', packId: 'unlimited', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) });
  await page.goto('/?login=1');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Senha').fill('senhaTeste123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/nova-simulacao/);
  return user;
}

test('mesa de negociação: veredito, limites e salvar oferta', async ({ page }) => {
  const user = await loginWithUnlimited(page);
  try {
    await page.goto('/negociacao');
    await page.locator('#ngPrincipal').fill('30000000');
    await page.locator('#ngProperty').fill('40000000');
    await page.locator('#ngRate').fill('10');
    await page.locator('#ngMonths').fill('360');
    await page.locator('#ngTeto').fill('300000');
    await page.locator('#ngBank').click();
    await page.getByRole('option', { name: 'Caixa', exact: true }).click();
    await expect(page.getByText(/Fecha no seu orçamento|No limite/)).toBeVisible();
    await expect(page.getByText('Taxa máxima')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar oferta' }).click();
    await expect(page.getByText('Oferta salva.')).toBeVisible();
    await expect(page.getByText('Ofertas salvas')).toBeVisible();
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});

test('mesa de negociação: teto que não cabe', async ({ page }) => {
  const user = await loginWithUnlimited(page);
  try {
    await page.goto('/negociacao');
    await page.locator('#ngPrincipal').fill('30000000');
    await page.locator('#ngProperty').fill('40000000');
    await page.locator('#ngRate').fill('10');
    await page.locator('#ngMonths').fill('360');
    await page.locator('#ngTeto').fill('100000');
    await page.locator('#ngBank').click();
    await page.getByRole('option', { name: 'Caixa', exact: true }).click();
    await expect(page.getByText('Não fecha com esse teto')).toBeVisible();
  } finally {
    await db.delete(schema.users).where(eq(schema.users.id, user.id));
  }
});
```

- [ ] **Step 2: Rodar (servidor de dev parado para subir com DB isolado)**

Run:
```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
DATABASE_URL='postgres://postgres:postgres@localhost:5433/financiamento_trial_test' npx playwright test e2e/negotiation.spec.ts
```
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/negotiation.spec.ts
git commit -m "test(negotiation): e2e verdict, limits and save"
```

---

## Verificação final (após as tasks)

- `npx tsc --noEmit`
- `npm test`
- `npx eslint` nos arquivos novos/alterados
- `npm run build`
- e2e `negotiation.spec.ts` + `landing-responsive.spec.ts`
- Commit final; sem push.
