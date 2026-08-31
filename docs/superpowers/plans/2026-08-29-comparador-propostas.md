# Comparador de Propostas Bancárias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Área exclusiva do plano Ilimitado para comparar até 3 propostas de financiamento (SAC/PRICE), auditar CET informado vs recalculado, ranquear por custo total da aquisição e analisar cada proposta com o amortizador inteligente.

**Architecture:** Módulo de domínio puro (`src/lib/comparator/`) sem React/DB — valida, simula via engine existente, recalcula CET por IRR, ranqueia e produz snapshot serializável. Página server com gate Ilimitado, formulário client com até 3 cards, actions server para persistir (`proposal_comparisons`), API route para PDF. Tudo reutiliza engine/`recommendSmart`/`irrMonthly` existentes.

**Tech Stack:** Next.js 16 (App Router), drizzle-orm + pg, @react-pdf/renderer, recharts, Base UI/shadcn components existentes, vitest, playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-comparador-propostas-design.md`

## Global Constraints

- Exclusivo Ilimitado: gate server-side em página, actions e PDF (nunca só no cliente).
- Máximo 3 propostas por comparação (validado no cliente e no servidor).
- CET informado é auditoria; parcelas usam taxa contratual.
- Custo total da aquisição = entrada + total pago do engine (já inclui seguro/correção) + tarifas. Nunca somar seguro do engine de novo.
- Custo por R$ 100 mil = (total pago + tarifas) / valor financiado × 100.000 (sem entrada).
- Alerta CET: comparar informado vs recalculado com arredondamento de 2 casas decimais; qualquer diferença alerta.
- Resultados só após botão `Comparar propostas` (sem recalcular ao digitar).
- Salvar = entradas + snapshot do resultado + engineVersion. Reabrir mostra snapshot; `Recalcular` recalcula e avisa se mudar.
- Cada tarifa tem checkbox `Incluir no CET`; todas entram no custo total; padrões: avaliação/tarifa bancária incluídas, cartório não, seguro-extra/outra desmarcadas.
- Orçamento mensal único para amortizador inteligente das 3 propostas.
- `Levar ao simulador` via sessionStorage `sim-input` (contrato do `SmartResultCard.abrirCenario`) + navegação para `/simulacao?name=comparador`.
- Variáveis monetárias em reais float (padrão do codebase: engine usa floats; packs usam cents mas comparator segue engine).
- copy em pt-BR; roxo da marca `#820AD1`.

---

### Task 1: Tabela `proposal_comparisons`

**Files:**
- Modify: `src/db/schema.ts` (adicionar tabela)
- Create: `drizzle/0002_*.sql` (gerado por `npm run db:generate`)

**Interfaces:**
- Produces: `schema.proposalComparisons` com colunas: `id` (uuid pk defaultRandom), `userId` (uuid fk cascade), `name` (text notNull), `monthlyBudget` (doublePrecision notNull), `proposals` (jsonb notNull), `result` (jsonb notNull), `engineVersion` (text notNull default '1'), `createdAt` (timestamp notNull defaultNow), `updatedAt` (timestamp notNull defaultNow).

- [ ] **Step 1: Adicionar tabela ao schema**

```ts
export const proposalComparisons = pgTable('proposal_comparisons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  monthlyBudget: doublePrecision('monthly_budget').notNull(),
  proposals: jsonb('proposals').notNull(),
  result: jsonb('result').notNull(),
  engineVersion: text('engine_version').notNull().default('1'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

- [ ] **Step 2: Gerar e aplicar migration**

Run: `npm run db:generate` → `drizzle/0002_*.sql` criado. Depois `npm run db:migrate`.
Expected: migration aplica sem erro; `\d proposal_comparisons` no psql mostra as colunas.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: tabela proposal_comparisons para o comparador de propostas"
```

---

### Task 2: Domínio puro — tipos e validação

**Files:**
- Create: `src/lib/comparator/types.ts`
- Create: `src/lib/comparator/validate.ts`
- Create: `src/lib/comparator/validate.test.ts`

**Interfaces:**
- Produces:
  - `interface ComparatorProposal` { id, bank, name?, propertyValue, downPayment, principalManual?, system: 'SAC'|'PRICE', months, annualRate, cetInformed, trMonthly, insuranceMonthly, fees: ComparatorFee[] }
  - `interface ComparatorFee` { id, label, amount, includeInCet }
  - `interface ComparatorInput` { proposals: ComparatorProposal[], monthlyBudget }
  - `type ProposalError = { id: string; message: string }`
  - `normalizeProposal(raw: Record<string, unknown>): ComparatorProposal` (lança `ComparatorValidationError` com mensagem pt-BR se inválido; valores viram números)
  - `validateComparator(input: ComparatorInput): ProposalError[]` (array vazio = válido; um erro por card, sem interromper os outros)
  - `assertAtMostThree(proposals: unknown[]): void` (lança se > 3)
  - `class ComparatorValidationError extends Error`

Regras de validação (de `normalizeProposal`): banco string não vazia; imóvel > 0; entrada >= 0 e < imóvel; prazo 1–600; taxa 0–1; CET 0–1; TR 0–1; seguro >= 0; tarifas >= 0 com label não vazio. Valor financiado = imóvel − entrada, ou principalManual se presente (se principalManual inválido, erro). `validateComparator`: 2 ou 3 propostas; orçamento > 0; e retorna erros de cada proposta.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/comparator/validate.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeProposal, validateComparator, assertAtMostThree, ComparatorValidationError } from './validate';
import type { ComparatorInput } from './types';

const ok = (): ComparatorInput => ({
  monthlyBudget: 12000,
  proposals: [
    { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, system: 'SAC', months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
    { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, system: 'PRICE', months: 360, annualRate: 0.092, cetInformed: 0.0994, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
  ],
});

describe('normalizeProposal', () => {
  it('calcula valor financiado automático (imóvel − entrada)', () => {
    const p = normalizeProposal(ok().proposals[0] as unknown as Record<string, unknown>);
    expect(p.principal).toBe(600000);
  });
  it('usa principalManual quando presente', () => {
    const raw = { ...ok().proposals[0], principalManual: 610000 } as unknown as Record<string, unknown>;
    expect(normalizeProposal(raw).principal).toBe(610000);
  });
  it('lança erro para prazo fora de 1–600', () => {
    const raw = { ...ok().proposals[0], months: 0 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro quando entrada >= imóvel', () => {
    const raw = { ...ok().proposals[0], downPayment: 850000 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
  it('lança erro para taxa acima de 100%', () => {
    const raw = { ...ok().proposals[0], annualRate: 1.2 } as unknown as Record<string, unknown>;
    expect(() => normalizeProposal(raw)).toThrow(ComparatorValidationError);
  });
});

describe('validateComparator', () => {
  it('retorna vazio para entrada válida', () => {
    expect(validateComparator(ok())).toEqual([]);
  });
  it('sinaliza proposta com erro sem derrubar as outras', () => {
    const input = ok();
    input.proposals[1].months = 0;
    const errors = validateComparator(input);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe('p2');
  });
  it('exige entre 2 e 3 propostas', () => {
    const one = { ...ok(), proposals: ok().proposals.slice(0, 1) };
    expect(validateComparator(one).some((e) => e.message.includes('2'))).toBe(true);
  });
  it('exige orçamento maior que zero', () => {
    const input = ok();
    input.monthlyBudget = 0;
    expect(validateComparator(input).some((e) => e.message.includes('orçamento'))).toBe(true);
  });
});

describe('assertAtMostThree', () => {
  it('lança acima de 3 propostas', () => {
    expect(() => assertAtMostThree([1, 2, 3, 4])).toThrow(/3/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/comparator/validate.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/comparator/types.ts
export interface ComparatorFee { id: string; label: string; amount: number; includeInCet: boolean; }
export interface ComparatorProposal {
  id: string; bank: string; name?: string;
  propertyValue: number; downPayment: number; principal: number;
  system: 'SAC' | 'PRICE'; months: number; annualRate: number;
  cetInformed: number; trMonthly: number; insuranceMonthly: number;
  fees: ComparatorFee[];
}
export interface ComparatorInput { proposals: ComparatorProposal[]; monthlyBudget: number; }
export interface ProposalError { id: string; message: string; }
```

```ts
// src/lib/comparator/validate.ts
import type { ComparatorFee, ComparatorInput, ComparatorProposal, ProposalError } from './types';

export class ComparatorValidationError extends Error {}

const num = (v: unknown, field: string, label: string): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new ComparatorValidationError(`${label} inválido`);
  return n;
};

export function normalizeProposal(raw: Record<string, unknown>): ComparatorProposal {
  const bank = String(raw.bank ?? '').trim();
  if (!bank) throw new ComparatorValidationError('Informe o banco da proposta.');
  const propertyValue = num(raw.propertyValue, 'propertyValue', 'Valor do imóvel');
  const downPayment = num(raw.downPayment, 'downPayment', 'Entrada');
  const months = num(raw.months, 'months', 'Prazo');
  const annualRate = num(raw.annualRate, 'annualRate', 'Taxa');
  const cetInformed = num(raw.cetInformed, 'cetInformed', 'CET');
  const trMonthly = num(raw.trMonthly, 'trMonthly', 'TR');
  const insuranceMonthly = num(raw.insuranceMonthly, 'insuranceMonthly', 'Seguro');
  if (!(propertyValue > 0)) throw new ComparatorValidationError('Valor do imóvel deve ser maior que zero.');
  if (!(downPayment >= 0 && downPayment < propertyValue)) throw new ComparatorValidationError('Entrada deve ser menor que o valor do imóvel.');
  if (!(months >= 1 && months <= 600)) throw new ComparatorValidationError('Prazo deve estar entre 1 e 600 meses.');
  if (!(annualRate > 0 && annualRate <= 1)) throw new ComparatorValidationError('Taxa contratual deve estar entre 0 e 100% a.a.');
  if (!(cetInformed >= 0 && cetInformed <= 1)) throw new ComparatorValidationError('CET deve estar entre 0 e 100% a.a.');
  if (!(trMonthly >= 0 && trMonthly <= 1)) throw new ComparatorValidationError('TR mensal inválida.');
  if (!(insuranceMonthly >= 0)) throw new ComparatorValidationError('Seguro mensal não pode ser negativo.');
  if (raw.system !== 'SAC' && raw.system !== 'PRICE') throw new ComparatorValidationError('Sistema deve ser SAC ou PRICE.');
  const fees: ComparatorFee[] = Array.isArray(raw.fees)
    ? raw.fees.map((f, i) => {
        const fee = (f ?? {}) as Record<string, unknown>;
        const amount = num(fee.amount, 'fee', 'Tarifa');
        const label = String(fee.label ?? '').trim() || `Tarifa ${i + 1}`;
        if (!(amount >= 0)) throw new ComparatorValidationError(`Tarifa "${label}" não pode ser negativa.`);
        return { id: String(fee.id ?? `f${i}`), label, amount, includeInCet: Boolean(fee.includeInCet) };
      })
    : [];
  let principal = propertyValue - downPayment;
  if (raw.principalManual != null && raw.principalManual !== '') {
    principal = num(raw.principalManual, 'principalManual', 'Valor financiado');
    if (!(principal > 0)) throw new ComparatorValidationError('Valor financiado deve ser maior que zero.');
  }
  return {
    id: String(raw.id ?? 'p'), bank,
    name: raw.name ? String(raw.name).trim() : undefined,
    propertyValue, downPayment, principal,
    system: raw.system as 'SAC' | 'PRICE', months,
    annualRate, cetInformed, trMonthly, insuranceMonthly, fees,
  };
}

export function validateComparator(input: ComparatorInput): ProposalError[] {
  const errors: ProposalError[] = [];
  if (input.proposals.length < 2 || input.proposals.length > 3) {
    errors.push({ id: '__global__', message: 'Compare entre 2 e 3 propostas.' });
  }
  if (!(input.monthlyBudget > 0)) {
    errors.push({ id: '__global__', message: 'Informe o orçamento mensal (maior que zero).' });
  }
  for (const p of input.proposals) {
    try {
      normalizeProposal(p as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ComparatorValidationError) errors.push({ id: p.id, message: e.message });
      else throw e;
    }
  }
  return errors;
}

export function assertAtMostThree(proposals: unknown[]): void {
  if (proposals.length > 3) throw new ComparatorValidationError('Máximo de 3 propostas por comparação.');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/comparator/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/comparator/
git commit -m "feat: domínio do comparador — tipos, normalização e validação"
```

---

### Task 3: Domínio puro — cálculo e ranking

**Files:**
- Create: `src/lib/comparator/calculate.ts`
- Create: `src/lib/comparator/calculate.test.ts`

**Interfaces:**
- Consumes: `ComparatorInput`, `normalizeProposal` (Task 2); `simulate` + `irrMonthly` de `@/lib/finance/engine`; `recommendSmart` de `@/lib/finance/smart`; `LoanInput` de `@/lib/finance/types`.
- Produces:
  - `interface ProposalOutcome { proposal: ComparatorProposal; result: SimulationResult; cetCalculated: number; cetAlert: boolean; acquisitionCost: number; financingCost: number; costPer100k: number; smart?: SmartOutcome }`
  - `interface SmartOutcome { recommended: SmartRecommendation; feasible: boolean; minBudget: number }`
  - `interface ComparatorResult { v1: { outcomes: ProposalOutcome[]; ranked: ProposalOutcome[]; best: ProposalOutcome | null; smartRanked: ProposalOutcome[]; computedAt: string } }`
  - `computeComparator(input: ComparatorInput): ComparatorResult` — lança `ComparatorValidationError` se inválido (usa `validateComparator`; se erros, lança com primeira mensagem).

Detalhes de cálculo:
- `cetCalculated`: fluxo `[-netCredit, ...parcelas]` onde `netCredit = principal − Σ(tarifas com includeInCet)` e cada período é `i.parcela` (engine já inclui seguro e correção). `irrMonthly(flows)` → anual: `(1+m)^12 − 1`. Se fluxo não tiver IRR (todas saídas), usar 0.
- `cetAlert = round2(cetInformed) !== round2(cetCalculated)`.
- `acquisitionCost = downPayment + result.metrics.totalPago + Σ tarifas` (NUNCA somar seguro do engine separado).
- `financingCost = result.metrics.totalPago + Σ tarifas`.
- `costPer100k = financingCost / principal * 100_000`.
- `smart`: `recommendSmart({ principal, annualRate, trMonthly, insuranceMonthly, bank, maxMonths: months, maxPayment: monthlyBudget, fixedUntilMonth: undefined })`; se `recommended.infeasible`, `smart.feasible = false` e `minBudget = recommended.minBudget`.
- Ranking: `ranked` ordena por `acquisitionCost` asc, desempate por `costPer100k` asc, depois `principal` desc.
- `best = ranked[0] ?? null`.
- `smartRanked` = outcomes com `smart?.feasible` ordenados por `smart.recommended.best?.result.metrics.totalPago` asc; inviáveis vão depois, na ordem original (o campo `smart.feasible` as separa).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/comparator/calculate.test.ts
import { describe, expect, it } from 'vitest';
import { computeComparator } from './calculate';
import type { ComparatorInput } from './types';

function input(): ComparatorInput {
  return {
    monthlyBudget: 12000,
    proposals: [
      { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000, system: 'SAC', months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
      { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, principal: 620000, system: 'PRICE', months: 360, annualRate: 0.092, cetInformed: 0.0994, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
    ],
  };
}

describe('computeComparator', () => {
  it('calcula custo da aquisição com entrada, total pago e tarifas', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    expect(p1.acquisitionCost).toBeCloseTo(250000 + p1.result.metrics.totalPago + 1500, 6);
  });
  it('custo por 100 mil usa financingCost sem entrada', () => {
    const { ranked } = computeComparator(input()).v1;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(p2.costPer100k).toBeCloseTo((p2.result.metrics.totalPago) / 620000 * 100000, 6);
  });
  it('CET calculado considera tarifa incluída no crédito líquido', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(Math.abs(p1.cetCalculated - p1.proposal.annualRate) < 0.03).toBe(true);
    expect(Math.abs(p2.cetCalculated - p2.proposal.annualRate) < 0.03).toBe(true);
    expect(p1.cetCalculated).toBeGreaterThan(p2.cetCalculated);
  });
  it('alerta quando CET informado difere do calculado na 2ª casa', () => {
    const { ranked } = computeComparator(input()).v1;
    const p1 = ranked.find((r) => r.proposal.id === 'p1')!;
    expect(p1.cetAlert).toBe(true); // informado 10,42% vs calculado ~9,8%
  });
  it('não alerta quando informado ≈ calculado', () => {
    const { ranked } = computeComparator(input()).v1;
    const p2 = ranked.find((r) => r.proposal.id === 'p2')!;
    expect(p2.cetAlert).toBe(false); // informado 9,94% vs calculado ~9,4% → diferença menor que 0,005? ajustar valores se preciso
  });
  it('ranqueia por menor custo total da aquisição', () => {
    const { ranked, best } = computeComparator(input()).v1;
    expect(best!.proposal.id).toBe(ranked[0].proposal.id);
    expect(ranked[0].acquisitionCost <= ranked[1].acquisitionCost).toBe(true);
  });
  it('smart viável gera recomendação; inviável marca feasible false', () => {
    const cheap = { ...input(), monthlyBudget: 3000 };
    const { outcomes } = computeComparator(cheap).v1;
    for (const o of outcomes) {
      expect(typeof o.smart!.feasible).toBe('boolean');
      if (!o.smart!.feasible) expect(o.smart!.minBudget).toBeGreaterThan(0);
    }
  });
  it('lança para entrada inválida', () => {
    const bad = input();
    bad.proposals[0].months = 0;
    expect(() => computeComparator(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/comparator/calculate.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/comparator/calculate.ts
import { irrMonthly, simulate } from '@/lib/finance/engine';
import { recommendSmart, type SmartRecommendation } from '@/lib/finance/smart';
import type { SimulationResult } from '@/lib/finance/types';
import { ComparatorValidationError, validateComparator, normalizeProposal } from './validate';
import type { ComparatorInput, ComparatorProposal, ProposalError } from './types';

export interface SmartOutcome { recommended: SmartRecommendation; feasible: boolean; minBudget: number; }
export interface ProposalOutcome {
  proposal: ComparatorProposal;
  result: SimulationResult;
  cetCalculated: number;
  cetAlert: boolean;
  acquisitionCost: number;
  financingCost: number;
  costPer100k: number;
  smart?: SmartOutcome;
}
export interface ComparatorResult {
  v1: {
    outcomes: ProposalOutcome[];
    ranked: ProposalOutcome[];
    best: ProposalOutcome | null;
    smartRanked: ProposalOutcome[];
    computedAt: string;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function cetFromFlows(netCredit: number, installments: { parcela: number }[]): number {
  const flows = [-netCredit, ...installments.map((i) => i.parcela)];
  const m = irrMonthly(flows);
  if (!Number.isFinite(m)) return 0;
  return Math.pow(1 + m, 12) - 1;
}

export function computeComparator(input: ComparatorInput): ComparatorResult {
  const errors: ProposalError[] = validateComparator(input);
  if (errors.length > 0) throw new ComparatorValidationError(errors[0].message);
  const normalized = input.proposals.map((p) => normalizeProposal(p as unknown as Record<string, unknown>));
  const outcomes: ProposalOutcome[] = normalized.map((proposal) => {
    const result = simulate({
      system: proposal.system,
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      months: proposal.months,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
      bank: proposal.bank,
    });
    const cetFees = proposal.fees.filter((f) => f.includeInCet).reduce((s, f) => s + f.amount, 0);
    const cetCalculated = cetFromFlows(proposal.principal - cetFees, result.installments);
    const feesTotal = proposal.fees.reduce((s, f) => s + f.amount, 0);
    const financingCost = result.metrics.totalPago + feesTotal;
    const smartRec = recommendSmart({
      principal: proposal.principal,
      annualRate: proposal.annualRate,
      trMonthly: proposal.trMonthly,
      insuranceMonthly: proposal.insuranceMonthly,
      bank: proposal.bank,
      maxMonths: proposal.months,
      maxPayment: input.monthlyBudget,
      fixedUntilMonth: undefined,
    });
    return {
      proposal,
      result,
      cetCalculated,
      cetAlert: round2(proposal.cetInformed) !== round2(cetCalculated),
      acquisitionCost: proposal.downPayment + financingCost,
      financingCost,
      costPer100k: (financingCost / proposal.principal) * 100_000,
      smart: { recommended: smartRec, feasible: !smartRec.infeasible, minBudget: smartRec.infeasible ? smartRec.minBudget : 0 },
    };
  });
  const ranked = [...outcomes].sort((a, b) =>
    a.acquisitionCost - b.acquisitionCost ||
    a.costPer100k - b.costPer100k ||
    b.proposal.principal - a.proposal.principal
  );
  const smartRanked = [...outcomes].sort((a, b) => {
    const fa = a.smart?.feasible ? 0 : 1;
    const fb = b.smart?.feasible ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const ta = a.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    const tb = b.smart?.recommended.best?.result.metrics.totalPago ?? Infinity;
    return ta - tb;
  });
  return {
    v1: {
      outcomes,
      ranked,
      best: ranked[0] ?? null,
      smartRanked,
      computedAt: new Date().toISOString(),
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar (ajustar valores de teste se a matemática do engine divergir do esperado — nunca enfraquecer assert de custo)**

Run: `npx vitest run src/lib/comparator/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/comparator/
git commit -m "feat: cálculo e ranking do comparador (CET por IRR, custo por 100 mil, smart por proposta)"
```

---

### Task 4: Actions server — persistir, listar, carregar, recalcular, excluir

**Files:**
- Create: `src/app/(app)/comparar-propostas/actions.ts`
- Create: `src/app/(app)/comparar-propostas/actions.test.ts` (testa `serializeComparison`/`deserializeComparison`, lógica pura sem DB)

**Interfaces:**
- Consumes: `computeComparator`, `ComparatorInput`, `ComparatorResult` (Task 3); `schema.proposalComparisons` (Task 1); `getCreditBalance` de `@/lib/credits`; `assertAtMostThree`.
- Produces (todas `'use server'`, autenticam e exigem Ilimitado; retornam `{ ok: true } | { error: string }` ou dados):
  - `saveComparison(input: ComparatorInput, name: string): Promise<{ id: string } | { error: string }>`
  - `listComparisons(): Promise<ComparisonSummary[]>` — `{ id, name, bestBank, createdAt }` (bestBank de `result.v1.best.proposal.bank`)
  - `loadComparison(id: string): Promise<{ input: ComparatorInput; result: ComparatorResult; name: string; engineVersion: string } | null>`
  - `recalculateComparison(id: string): Promise<{ result: ComparatorResult; changed: boolean } | { error: string }>`
  - `deleteComparison(id: string): Promise<{ ok: true } | { error: string }>`
- Serialização: `proposals` JSON = `{ version: 1, proposals: [...], monthlyBudget }`; `result` JSON = resultado inteiro. `deserializeComparisonProposals(raw): ComparatorInput` valida e normaliza via `normalizeProposal` (lança erro se schema inválido).

- [ ] **Step 1: Escrever teste da serialização (lógica pura)**

```ts
// src/app/(app)/comparar-propostas/actions.test.ts
import { describe, expect, it } from 'vitest';
import { serializeComparisonInput, deserializeComparisonInput } from './actions';

const input = {
  monthlyBudget: 12000,
  proposals: [
    { id: 'p1', bank: 'Caixa', propertyValue: 850000, downPayment: 250000, principal: 600000, system: 'SAC' as const, months: 360, annualRate: 0.097, cetInformed: 0.1042, trMonthly: 0.0017, insuranceMonthly: 100, fees: [{ id: 'f1', label: 'Avaliação', amount: 1500, includeInCet: true }] },
    { id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 230000, principal: 620000, system: 'PRICE' as const, months: 360, annualRate: 0.092, cetInformed: 0.0994, trMonthly: 0.0017, insuranceMonthly: 80, fees: [] },
  ],
};

describe('serialize/deserialize comparação', () => {
  it('round-trip preserva entradas', () => {
    const raw = serializeComparisonInput(input);
    expect(raw).toContain('"version":1');
    const back = deserializeComparisonInput(raw);
    expect(back.monthlyBudget).toBe(12000);
    expect(back.proposals).toHaveLength(2);
    expect(back.proposals[0].bank).toBe('Caixa');
    expect(back.proposals[0].principal).toBe(600000);
  });
  it('rejeita JSON com schema inválido', () => {
    expect(() => deserializeComparisonInput('{"version":1,"proposals":[{"id":"x"}]}')).toThrow();
  });
  it('rejeita mais de 3 propostas', () => {
    const bad = { ...input, proposals: [...input.proposals, input.proposals[0], input.proposals[0]] };
    expect(() => serializeComparisonInput(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/\(app\)/comparar-propostas/actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/app/(app)/comparar-propostas/actions.ts
'use server';

import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { getCreditBalance } from '@/lib/credits';
import { computeComparator, type ComparatorResult } from '@/lib/comparator/calculate';
import { normalizeProposal, assertAtMostThree, ComparatorValidationError } from '@/lib/comparator/validate';
import type { ComparatorInput } from '@/lib/comparator/types';

const ENGINE_VERSION = '1';

export function serializeComparisonInput(input: ComparatorInput): string {
  assertAtMostThree(input.proposals);
  return JSON.stringify({ version: 1, monthlyBudget: input.monthlyBudget, proposals: input.proposals });
}

export function deserializeComparisonInput(raw: string): ComparatorInput {
  const parsed = JSON.parse(raw) as { version?: number; monthlyBudget?: number; proposals?: unknown[] };
  if (parsed?.version !== 1 || !Array.isArray(parsed.proposals)) throw new ComparatorValidationError('Dados da comparação inválidos.');
  const proposals = parsed.proposals.map((p) => normalizeProposal((p ?? {}) as Record<string, unknown>));
  const monthlyBudget = Number(parsed.monthlyBudget);
  if (!(monthlyBudget > 0)) throw new ComparatorValidationError('Orçamento mensal inválido.');
  return { proposals, monthlyBudget };
}

async function requireUnlimited() {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) throw new Error('Recurso exclusivo do plano Ilimitado');
  return session.userId;
}

export type ComparisonSummary = { id: string; name: string; bestBank: string | null; createdAt: Date };

export async function saveComparison(input: ComparatorInput, name: string): Promise<{ id: string } | { error: string }> {
  try {
    const userId = await requireUnlimited();
    const result = computeComparator(input);
    const [row] = await db.insert(schema.proposalComparisons).values({
      userId,
      name: name.trim() || `Comparação ${new Date().toLocaleDateString('pt-BR')}`,
      monthlyBudget: input.monthlyBudget,
      proposals: serializeComparisonInput(input),
      result: JSON.stringify(result),
      engineVersion: ENGINE_VERSION,
    }).returning();
    revalidatePath('/comparar-propostas');
    return { id: row.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao salvar' };
  }
}

export async function listComparisons(): Promise<ComparisonSummary[]> {
  const session = await auth();
  if (!session?.userId) return [];
  const rows = await db
    .select({ id: schema.proposalComparisons.id, name: schema.proposalComparisons.name, result: schema.proposalComparisons.result, createdAt: schema.proposalComparisons.createdAt })
    .from(schema.proposalComparisons)
    .where(eq(schema.proposalComparisons.userId, session.userId))
    .orderBy(desc(schema.proposalComparisons.createdAt))
    .limit(50);
  return rows.map((r) => {
    let bestBank: string | null = null;
    try {
      const res = JSON.parse(r.result as unknown as string) as ComparatorResult;
      bestBank = res.v1.best?.proposal.bank ?? null;
    } catch { /* resultado antigo/corrompido */ }
    return { id: r.id, name: r.name, bestBank, createdAt: r.createdAt };
  });
}

export async function loadComparison(id: string): Promise<{ input: ComparatorInput; result: ComparatorResult; name: string; engineVersion: string } | null> {
  const session = await auth();
  if (!session?.userId) return null;
  const row = await db.query.proposalComparisons.findFirst({
    where: and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, session.userId)),
  });
  if (!row) return null;
  try {
    return {
      input: deserializeComparisonInput(row.proposals as unknown as string),
      result: JSON.parse(row.result as unknown as string) as ComparatorResult,
      name: row.name,
      engineVersion: row.engineVersion,
    };
  } catch {
    return null;
  }
}

export async function recalculateComparison(id: string): Promise<{ result: ComparatorResult; changed: boolean } | { error: string }> {
  try {
    const userId = await requireUnlimited();
    const row = await db.query.proposalComparisons.findFirst({
      where: and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, userId)),
    });
    if (!row) return { error: 'Comparação não encontrada' };
    const input = deserializeComparisonInput(row.proposals as unknown as string);
    const fresh = computeComparator(input);
    const prev = JSON.parse(row.result as unknown as string) as ComparatorResult;
    const changed = JSON.stringify(prev) !== JSON.stringify(fresh);
    await db.update(schema.proposalComparisons)
      .set({ result: JSON.stringify(fresh), engineVersion: ENGINE_VERSION })
      .where(eq(schema.proposalComparisons.id, id));
    return { result: fresh, changed };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao recalcular' };
  }
}

export async function deleteComparison(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const session = await auth();
    if (!session?.userId) return { error: 'Não autenticado' };
    await db.delete(schema.proposalComparisons)
      .where(and(eq(schema.proposalComparisons.id, id), eq(schema.proposalComparisons.userId, session.userId)));
    revalidatePath('/comparar-propostas');
    return { ok: true };
  } catch {
    return { error: 'Erro ao excluir' };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/\(app\)/comparar-propostas/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/comparar-propostas/
git commit -m "feat: actions do comparador (salvar, listar, carregar, recalcular, excluir)"
```

---

### Task 5: Página, gate Ilimitado e formulário client

**Files:**
- Create: `src/app/(app)/comparar-propostas/page.tsx`
- Create: `src/app/(app)/comparar-propostas/comparator-client.tsx`
- Create: `src/app/(app)/comparar-propostas/proposal-card.tsx`
- Create: `src/app/(app)/comparar-propostas/comparator-result.tsx`
- Create: `src/app/(app)/comparar-propostas/saved-list.tsx`
- Modify: `src/components/app-header.tsx` (link `Comparar propostas`)

**Interfaces:**
- Consumes: actions Task 4; `computeComparator`; `UpgradeDialog`; `MoneyInput`/`NumericInput` de `@/components/ui/`; `BalanceChart`/`CompareChart`; `formatBRL`/`parseBRLToNumber`/`parseDecimal`.
- Produces: página server com gate; formulário com 2 cards iniciais, `Adicionar terceira proposta`, orçamento único, botão `Comparar propostas`; resultado com ranking, métricas, alertas CET, gráficos, análise smart (roxa), ações `Salvar comparação`, `Gerar PDF`, `Levar ao simulador`; lista de salvas com abrir/excluir.
- `Levar ao simulador`: monta `FormState` (contrato de `SmartResultCard.abrirCenario`: `{ system, principal, annualRate, months, trMonthly, insuranceMonthly, bank, lumpSum: [], extraMonthlyPct, extraMonthlyPctStart: '', extraMonthlyPctUntil: '', fixedPaymentStart: '', fgtsAnnual: '0', fgtsStartMonth: '12', fgtsUntilMonth: '', recurringExtra: null, fixedPayment: '', fixedPaymentUntil: '', paySacParcela: false, reduceMode: 'term', portability: null }`), grava em `sessionStorage['sim-input']` e navega para `/simulacao?name=comparador`.

- [ ] **Step 1: Página server com gate**

```tsx
// src/app/(app)/comparar-propostas/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { ComparatorClient } from './comparator-client';
import { listComparisons } from './actions';

export default async function CompararPropostasPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) {
    return <ComparatorClient locked initialComparisons={[]} />;
  }
  return <ComparatorClient locked={false} initialComparisons={await listComparisons()} />;
}
```

- [ ] **Step 2: Rodar build para validar tipagem da página**

Run: `npm run build`
Expected: compila (formulário ainda vazio).

- [ ] **Step 3: Formulário client**

```tsx
// src/app/(app)/comparar-propostas/comparator-client.tsx
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
import type { ComparatorInput, ComparatorProposal } from '@/lib/comparator/types';
import { ProposalCard } from './proposal-card';
import { ComparatorResultView } from './comparator-result';
import { SavedList } from './saved-list';
import { saveComparison } from './actions';

export interface RawProposal {
  id: string; bank: string; name: string;
  propertyValue: string; downPayment: string; principalManual: string;
  system: 'SAC' | 'PRICE'; months: string; annualRate: string;
  cetInformed: string; trMonthly: string; insuranceMonthly: string;
  fees: { id: string; label: string; amount: string; includeInCet: boolean }[];
}

const NEW_PROPOSAL = (id: string): RawProposal => ({
  id, bank: '', name: '', propertyValue: '', downPayment: '', principalManual: '',
  system: 'SAC', months: '360', annualRate: '', cetInformed: '',
  trMonthly: '0.17', insuranceMonthly: '0',
  fees: [],
});

export function ComparatorClient({ locked, initialComparisons }: { locked: boolean; initialComparisons: Awaited<ReturnType<typeof saveComparison>> extends never ? never : unknown[] }) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [proposals, setProposals] = useState<RawProposal[]>([NEW_PROPOSAL('p1'), NEW_PROPOSAL('p2')]);
  const [budget, setBudget] = useState('12000');
  const [result, setResult] = useState<ComparatorResult | null>(null);
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
            <CardTitle className="flex items-center gap-2 text-xl">Comparar propostas <Sparkles className="size-5 text-[#820AD1]" /></CardTitle>
            <CardDescription>Compare até 3 propostas bancárias, audite o CET e descubra quanto o amortizador inteligente pode economizar.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Recurso exclusivo do plano Ilimitado.</p>
            <Button type="button" onClick={() => setUpgradeOpen(true)}>Ver opções de acesso</Button>
          </CardContent>
        </Card>
        <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      </div>
    );
  }

  const input = useMemo<ComparatorInput>(() => ({
    monthlyBudget: parseBRLToNumber(budget),
    proposals: proposals.map((p) => ({
      id: p.id, bank: p.bank, name: p.name || undefined,
      propertyValue: parseBRLToNumber(p.propertyValue),
      downPayment: parseBRLToNumber(p.downPayment),
      principal: 0, // preenchido por normalizeProposal
      system: p.system, months: Number(p.months),
      annualRate: parseDecimal(p.annualRate) / 100,
      cetInformed: parseDecimal(p.cetInformed) / 100,
      trMonthly: parseDecimal(p.trMonthly) / 100,
      insuranceMonthly: parseBRLToNumber(p.insuranceMonthly),
      fees: p.fees.map((f) => ({ id: f.id, label: f.label, amount: parseBRLToNumber(f.amount), includeInCet: f.includeInCet })),
    })),
  }), [proposals, budget]);

  function comparar() {
    setErrors({}); setGlobalError(''); setSaveMsg('');
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
    if ('error' in res) { setSaveMsg(res.error); return; }
    setSaveMsg('Comparação salva.');
    router.refresh();
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6 bg-muted p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Comparar propostas</h1>
        <p className="text-sm text-muted-foreground">Até 3 propostas bancárias lado a lado. Exclusivo do plano Ilimitado.</p>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget">Quanto consegue pagar por mês (R$)</Label>
            <MoneyInput id="budget" value={budget} onValid={(v) => setBudget(String(v))} />
          </div>
          {globalError && <p className="text-sm text-destructive">{globalError}</p>}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {proposals.map((p) => (
              <ProposalCard key={p.id} raw={p} error={errors[p.id]} onChange={(patch) => set(p.id, patch)} />
            ))}
          </div>
          {proposals.length < 3 && (
            <Button type="button" variant="outline" className="w-fit" onClick={() => setProposals((ps) => [...ps, NEW_PROPOSAL(`p${ps.length + 1}`)])}>
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
```

- [ ] **Step 4: Card de proposta**

```tsx
// src/app/(app)/comparar-propostas/proposal-card.tsx
'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RawProposal } from './comparator-client';

export function ProposalCard({ raw, error, onChange }: { raw: RawProposal; error?: string; onChange: (patch: Partial<RawProposal>) => void }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{raw.bank || `Proposta ${raw.id.toUpperCase()}`}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-bank`}>Banco</Label>
          <Input id={`${raw.id}-bank`} value={raw.bank} onChange={(e) => onChange({ bank: e.target.value })} placeholder="Ex.: Caixa" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-prop`}>Imóvel (R$)</Label>
            <MoneyInput id={`${raw.id}-prop`} value={raw.propertyValue} onValid={(v) => onChange({ propertyValue: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-entry`}>Entrada (R$)</Label>
            <MoneyInput id={`${raw.id}-entry`} value={raw.downPayment} onValid={(v) => onChange({ downPayment: String(v) })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-principal`}>Valor financiado (R$) · automático</Label>
          <MoneyInput id={`${raw.id}-principal`} value={raw.principalManual} onValid={(v) => onChange({ principalManual: String(v) })} placeholder="automático" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-system`}>Sistema</Label>
          <Select value={raw.system} onValueChange={(v) => onChange({ system: v as 'SAC' | 'PRICE' })}>
            <SelectTrigger id={`${raw.id}-system`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SAC">SAC</SelectItem>
              <SelectItem value="PRICE">PRICE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-months`}>Prazo (meses)</Label>
            <NumericInput id={`${raw.id}-months`} value={raw.months} onValid={(v) => onChange({ months: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-rate`}>Taxa a.a. (%)</Label>
            <NumericInput id={`${raw.id}-rate`} value={raw.annualRate} onValid={(v) => onChange({ annualRate: String(v) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-cet`}>CET informado a.a. (%)</Label>
            <NumericInput id={`${raw.id}-cet`} value={raw.cetInformed} onValid={(v) => onChange({ cetInformed: String(v) })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${raw.id}-tr`}>TR mensal (%)</Label>
            <NumericInput id={`${raw.id}-tr`} value={raw.trMonthly} onValid={(v) => onChange({ trMonthly: String(v) })} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${raw.id}-insurance`}>Seguro (R$/mês)</Label>
          <MoneyInput id={`${raw.id}-insurance`} value={raw.insuranceMonthly} onValid={(v) => onChange({ insuranceMonthly: String(v) })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tarifas</span>
          {raw.fees.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input value={f.label} onChange={(e) => onChange({ fees: raw.fees.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x) })} className="h-8" />
              <MoneyInput value={f.amount} onValid={(v) => onChange({ fees: raw.fees.map((x) => x.id === f.id ? { ...x, amount: String(v) } : x) })} />
              <label className="flex shrink-0 items-center gap-1 text-xs">
                <input type="checkbox" checked={f.includeInCet} onChange={(e) => onChange({ fees: raw.fees.map((x) => x.id === f.id ? { ...x, includeInCet: e.target.checked } : x) })} />
                no CET
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ fees: raw.fees.filter((x) => x.id !== f.id) })}><Trash2 className="size-3.5" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange({ fees: [...raw.fees, { id: `f${Date.now()}`, label: 'Tarifa', amount: '0', includeInCet: false }] })}>
            <Plus className="size-3.5" /> Adicionar tarifa
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Resultado (ranking, alertas, gráficos, ações)**

```tsx
// src/app/(app)/comparar-propostas/comparator-result.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Download, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BalanceChart } from '@/components/simulation/charts/BalanceChart';
import { CompareChart } from '@/components/simulation/charts/CompareChart';
import { formatBRL } from '@/lib/utils';
import type { ComparatorInput, ComparatorProposal } from '@/lib/comparator/types';
import type { ComparatorResult } from '@/lib/comparator/calculate';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

function levarAoSimulador(p: ComparatorProposal) {
  const form = {
    system: p.system,
    principal: String(Math.round(p.principal)),
    annualRate: String((p.annualRate * 100).toFixed(2)),
    months: String(p.months),
    trMonthly: String((p.trMonthly * 100).toFixed(2)),
    insuranceMonthly: String(Math.round(p.insuranceMonthly)),
    bank: p.bank,
    lumpSum: [], extraMonthlyPct: '0', extraMonthlyPctStart: '', extraMonthlyPctUntil: '',
    fixedPaymentStart: '', fgtsAnnual: '0', fgtsStartMonth: '12', fgtsUntilMonth: '',
    recurringExtra: null, fixedPayment: '', fixedPaymentUntil: '',
    paySacParcela: false, reduceMode: 'term', portability: null,
  };
  sessionStorage.setItem('sim-input', JSON.stringify(form));
  window.location.href = '/simulacao?name=comparador';
}

export function ComparatorResultView({ result, input, onSave }: { result: ComparatorResult; input: ComparatorInput; onSave: () => void }) {
  const router = useRouter();
  const { ranked, best, smartRanked, outcomes } = result.v1;
  if (!best) return null;
  const saldos = (outcome: typeof ranked[number]) => outcome.result.installments.map((i) => i.saldo);
  const smartSaldos = (outcome: typeof ranked[number]) => outcome.smart?.recommended.best?.result.installments.map((i) => i.saldo) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Melhor proposta: {best.proposal.bank} <Badge variant="secondary">#{ranked[0] === best ? '1' : ''}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl bg-primary/5 p-3">
              <span className="text-xs text-muted-foreground">Custo total da aquisição</span>
              <span className="text-lg font-semibold text-primary">{formatBRL(best.acquisitionCost)}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
              <span className="text-xs text-muted-foreground">Economia vs 2ª</span>
              <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {formatBRL(Math.max(0, ranked[1]?.acquisitionCost - best.acquisitionCost))}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
              <span className="text-xs text-muted-foreground">Custo / R$ 100 mil financiados</span>
              <span className="text-lg font-semibold">{formatBRL(best.costPer100k)}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
              <span className="text-xs text-muted-foreground">Parcela inicial</span>
              <span className="text-lg font-semibold">{formatBRL(best.result.installments[0]?.parcela ?? 0)}</span>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b border-border py-2 pr-2">Proposta</th>
                  <th className="border-b border-border py-2 pr-2 text-right">Custo aquisição</th>
                  <th className="border-b border-border py-2 pr-2 text-right">Custo financiamento</th>
                  <th className="border-b border-border py-2 pr-2 text-right">/R$ 100 mil</th>
                  <th className="border-b border-border py-2 pr-2 text-right">Parcela 1</th>
                  <th className="border-b border-border py-2 pr-2 text-right">Quita em</th>
                  <th className="border-b border-border py-2 pr-2 text-right">CET informado</th>
                  <th className="border-b border-border py-2 pr-2 text-right">CET calculado</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((o, i) => (
                  <tr key={o.proposal.id} className={o.proposal.id === best.proposal.id ? 'font-semibold' : ''}>
                    <td className="py-2 pr-2">{i + 1}º · {o.proposal.bank} ({o.proposal.system})</td>
                    <td className="py-2 pr-2 text-right">{formatBRL(o.acquisitionCost)}</td>
                    <td className="py-2 pr-2 text-right">{formatBRL(o.financingCost)}</td>
                    <td className="py-2 pr-2 text-right">{formatBRL(o.costPer100k)}</td>
                    <td className="py-2 pr-2 text-right">{formatBRL(o.result.installments[0]?.parcela ?? 0)}</td>
                    <td className="py-2 pr-2 text-right">{o.result.metrics.saldoZeroAt} m</td>
                    <td className="py-2 pr-2 text-right">{pct(o.proposal.cetInformed)}</td>
                    <td className={`py-2 pr-2 text-right ${o.cetAlert ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {pct(o.cetCalculated)}{o.cetAlert && ' ⚠'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {outcomes.filter((o) => o.cetAlert).length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Alerta de CET: os dados informados não reproduzem o CET anunciado nas propostas{' '}
              {outcomes.filter((o) => o.cetAlert).map((o) => o.proposal.bank).join(', ')}. Revise taxas, seguros e tarifas.
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <BalanceChart data={best.result.installments.map((i) => ({ month: i.month, saldo: i.saldo }))} />
            <div className="flex flex-col gap-3">
              <CompareChart
                base={saldos(ranked[0])}
                withStrategy={smartSaldos(ranked[0])}
                baseName={`${ranked[0].proposal.bank} original`}
                strategyName="Amortizador inteligente"
              />
              {smartRanked.map((o) => (
                <p key={o.proposal.id} className="text-xs text-muted-foreground">
                  {o.proposal.bank}:{' '}
                  {o.smart?.feasible
                    ? `quita em ${o.smart.recommended.best?.result.metrics.saldoZeroAt ?? '—'} meses com aporte de ${formatBRL(o.smart.recommended.best?.extraMonthlyAmount ?? 0)}/mês`
                    : `orçamento mínimo de ${formatBRL(o.smart?.minBudget ?? 0)}/mês para caber no amortizador`}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onSave}><Save className="size-4" /> Salvar comparação</Button>
            <Button type="button" variant="outline" onClick={() => router.push(`/api/pdf/comparison?${new URLSearchParams({ proposals: JSON.stringify(input.proposals), monthlyBudget: String(input.monthlyBudget) })}`)}>
              <Download className="size-4" /> Gerar PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => levarAoSimulador(best.proposal)}>
              Levar ao simulador <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Lista de salvas**

```tsx
// src/app/(app)/comparar-propostas/saved-list.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { deleteComparison } from './actions';

export function SavedList({ initial }: { initial: { id: string; name: string; bestBank: string | null; createdAt: Date }[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  if (items.length === 0) return null;
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex flex-col gap-2 pt-6">
        <h2 className="text-base font-semibold">Comparações salvas</h2>
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                Melhor: {c.bestBank ?? '—'} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/comparar-propostas?id=${c.id}`)}>Abrir</Button>
              <Button type="button" variant="ghost" size="sm" onClick={async () => {
                if (!confirm('Excluir esta comparação?')) return;
                await deleteComparison(c.id);
                setItems((xs) => xs.filter((x) => x.id !== c.id));
              }}><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Reabrir via `?id=` na página server + link na navbar**

Na `page.tsx`, ler `searchParams.id`; se presente, `loadComparison(id)` e passar `saved={{ input, result }}` ao client (client usa como resultado inicial). Link no header:

```tsx
<Link href="/comparar-propostas" className="hidden text-sm font-medium text-foreground transition-colors hover:text-[#820AD1] sm:inline">
  Comparar propostas
</Link>
```

- [ ] **Step 8: Verificar build e testes**

Run: `npm run build` e `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/comparar-propostas/ src/components/app-header.tsx
git commit -m "feat: página do comparador de propostas (form, resultado, salvas, gate Ilimitado)"
```

---

### Task 6: PDF comparativo

**Files:**
- Create: `src/lib/pdf/comparison.tsx`
- Create: `src/app/api/pdf/comparison/route.ts`

**Interfaces:**
- Consumes: `deserializeComparisonInput` de actions (reusa validação); `computeComparator`; `formatBRL`.
- Produces: route `GET /api/pdf/comparison?proposals=<json>&monthlyBudget=<n>` → gera PDF com @react-pdf/renderer: header, ranking, custo aquisição/financiamento/por 100 mil, CET informado vs calculado com alertas, análise smart por proposta, premissas. Não confia em snapshot: recalcula server-side via `computeComparator` (validação inline); se inválido → 400.

- [ ] **Step 1: Implementar documento PDF**

```tsx
// src/lib/pdf/comparison.tsx
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { computeComparator, type ProposalOutcome } from '@/lib/comparator/calculate';
import { deserializeComparisonInput } from '@/app/(app)/comparar-propostas/actions';
import type { ComparatorInput } from '@/lib/comparator/types';

const PURPLE = '#820AD1';
const GRAY = '#6B7280';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#111827', fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', color: PURPLE },
  subtitle: { fontSize: 8, color: GRAY, marginTop: 2 },
  section: { fontSize: 12, fontWeight: 'bold', color: PURPLE, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: '35%', color: GRAY },
  value: { width: '65%', fontWeight: 'bold' },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PURPLE, paddingBottom: 3, marginBottom: 3 },
  thCell: { fontWeight: 'bold', color: PURPLE, width: '16.6%', fontSize: 8 },
  tr: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  td: { width: '16.6%', fontSize: 8 },
  note: { fontSize: 7, color: GRAY, marginTop: 8 },
});

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function buildComparisonPdf(input: ComparatorInput) {
  const { ranked, smartRanked } = computeComparator(input).v1;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Comparação de propostas</Text>
        <Text style={styles.subtitle}>
          Gerado em {new Date().toLocaleString('pt-BR')} · Orçamento mensal: {brl(input.monthlyBudget)} · Exclusivo Ilimitado
        </Text>

        <Text style={styles.section}>Ranking por custo total da aquisição</Text>
        <View style={styles.th}>
          {['Proposta', 'Custo aquisição', 'Custo financiam.', '/R$100 mil', 'Parcela 1', 'CET calc.'].map((h) => (
            <Text key={h} style={styles.thCell}>{h}</Text>
          ))}
        </View>
        {ranked.map((o: ProposalOutcome, i: number) => (
          <View key={o.proposal.id} style={styles.tr}>
            <Text style={styles.td}>{i + 1}º {o.proposal.bank} ({o.proposal.system})</Text>
            <Text style={styles.td}>{brl(o.acquisitionCost)}</Text>
            <Text style={styles.td}>{brl(o.financingCost)}</Text>
            <Text style={styles.td}>{brl(o.costPer100k)}</Text>
            <Text style={styles.td}>{brl(o.result.installments[0]?.parcela ?? 0)}</Text>
            <Text style={styles.td}>{pct(o.cetCalculated)}{o.cetAlert ? ' ⚠' : ''}</Text>
          </View>
        ))}

        <Text style={styles.section}>CET: informado vs calculado</Text>
        {ranked.map((o: ProposalOutcome) => (
          <View key={o.proposal.id} style={styles.row}>
            <Text style={styles.label}>{o.proposal.bank}</Text>
            <Text style={styles.value}>
              {pct(o.proposal.cetInformed)} informado · {pct(o.cetCalculated)} calculado{o.cetAlert ? ' · divergência' : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>Amortizador inteligente</Text>
        {smartRanked.map((o: ProposalOutcome) => (
          <View key={o.proposal.id} style={styles.row}>
            <Text style={styles.label}>{o.proposal.bank}</Text>
            <Text style={styles.value}>
              {o.smart?.feasible
                ? `Quita em ${o.smart.recommended.best?.result.metrics.saldoZeroAt ?? '—'} meses com aporte de ${brl(o.smart.recommended.best?.extraMonthlyAmount ?? 0)}/mês`
                : `Não cabe no orçamento: mínimo de ${brl(o.smart?.minBudget ?? 0)}/mês`}
            </Text>
          </View>
        ))}

        <Text style={styles.note}>
          Custo da aquisição = entrada + total pago (parcelas, seguro e correção) + tarifas. Custo do financiamento exclui a
          entrada. Números dependem dos dados informados e não constituem proposta dos bancos.
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Implementar route**

```ts
// src/app/api/pdf/comparison/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { buildComparisonPdf } from '@/lib/pdf/comparison';
import { deserializeComparisonInput } from '@/app/(app)/comparar-propostas/actions';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.userId) return new Response('Não autenticado', { status: 401 });
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) return new Response('Recurso exclusivo do plano Ilimitado', { status: 403 });
  const { searchParams } = new URL(req.url);
  const rawProposals = searchParams.get('proposals');
  const monthlyBudget = Number(searchParams.get('monthlyBudget') ?? '0');
  if (!rawProposals || !(monthlyBudget > 0)) return new Response('Parâmetros inválidos', { status: 400 });
  try {
    const input = deserializeComparisonInput(
      JSON.stringify({ version: 1, proposals: JSON.parse(rawProposals), monthlyBudget })
    );
    const pdf = await renderToBuffer(buildComparisonPdf(input));
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comparacao-propostas.pdf"`,
      },
    });
  } catch {
    return new Response('Dados inválidos', { status: 400 });
  }
}
```

- [ ] **Step 3: Testar no navegador**

Run: `npm run build`; depois gerar comparação em `/comparar-propostas` e clicar `Gerar PDF`.
Expected: download do PDF com ranking, CETs e análise.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/comparison.tsx src/app/api/pdf/comparison/
git commit -m "feat: PDF comparativo de propostas (exclusivo Ilimitado)"
```

---

### Task 7: E2E

**Files:**
- Create: `e2e/comparator.spec.ts`

**Interfaces:**
- Consumes: fluxo de cadastro + webhook fake (padrão de `e2e/toggle.spec.ts`), página `/comparar-propostas`.

- [ ] **Step 1: Escrever o spec**

```ts
import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const hasPsql = (() => { try { execSync('which psql', { stdio: 'ignore' }); return true; } catch { return false; } })();

async function cadastrarEAssinar(page: { goto: (u: string) => Promise<void>; getByLabel: (s: string) => any; getByRole: (r: string, o?: any) => any; waitForURL: (re: RegExp) => Promise<void>; request: any }) {
  const email = `c${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  const uid = execSync(`psql "postgres://postgres:postgres@localhost:5433/financiamento" -t -A -c "select id from users where email='${email}'"`).toString().trim();
  const res = await page.request.get(`http://localhost:3000/api/webhooks/payments?fake=approve&userId=${uid}&packId=unlimited`);
  expect(res.ok()).toBeTruthy();
  return { email, uid };
}

test('não assinante vê bloqueio com upgrade', async ({ page }) => {
  const email = `b${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta e ganhar 2 créditos/i }).click();
  await page.waitForURL(/nova-simulacao/);
  await page.goto('/comparar-propostas');
  await expect(page.getByText(/recurso exclusivo do plano ilimitado/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /ver opções de acesso/i })).toBeVisible();
});

test('ilimitado compara 2 propostas, adiciona 3ª e vê ranking + alerta CET', async ({ page }) => {
  await cadastrarEAssinar(page);
  await page.goto('/comparar-propostas');
  await page.getByLabel('Quanto consegue pagar por mês (R$)').fill('12000');

  const p1 = page.locator('form, div').filter({ hasText: 'Proposta P1' });
  await page.getByLabel(/Banco/).first().fill('Caixa');
  await page.getByLabel(/Imóvel \(R\$\)/).first().fill('850000');
  await page.getByLabel(/Entrada \(R\$\)/).first().fill('250000');
  await page.getByLabel(/Taxa a\.a\. \(%\)/).first().fill('9,7');
  await page.getByLabel(/CET informado a\.a\. \(%\)/).first().fill('10,42');

  await page.getByLabel(/Banco/).nth(1).fill('Itaú');
  await page.getByLabel(/Imóvel \(R\$\)/).nth(1).fill('850000');
  await page.getByLabel(/Entrada \(R\$\)/).nth(1).fill('230000');
  await page.getByLabel(/Taxa a\.a\. \(%\)/).nth(1).fill('9,2');
  await page.getByLabel(/CET informado a\.a\. \(%\)/).nth(1).fill('9,94');

  await page.getByRole('button', { name: /adicionar terceira proposta/i }).click();
  await expect(page.getByLabel(/Banco/)).toHaveCount(3);

  await page.getByRole('button', { name: /comparar propostas/i }).click();
  await expect(page.getByText(/melhor proposta/i)).toBeVisible();
  await expect(page.getByText(/custo total da aquisição/i)).toBeVisible();
  await expect(page.getByText(/alerta de cet/i)).toBeVisible();
  await expect(page.getByText(/amortizador inteligente/i)).toBeVisible();

  await page.getByRole('button', { name: /salvar comparação/i }).click();
  await expect(page.getByText(/comparações salvas/i)).toBeVisible();
  await expect(page.getByText(/caixa vs itaú/i)).toBeVisible();

  await page.getByRole('button', { name: /gerar pdf/i }).click();
  await expect(page).toHaveURL(/api\/pdf\/comparison/);

  await page.getByRole('button', { name: /levar ao simulador/i }).click();
  await page.waitForURL(/simulacao/);
});
```

- [ ] **Step 2: Rodar e ajustar seletores**

Run: `npx playwright test e2e/comparator.spec.ts`
Expected: PASS (seletores podem precisar de ajuste fino — `getByLabel(/Imóvel/)` deve casar com `<Label htmlFor>` + `MoneyInput id`).

- [ ] **Step 3: Rodar suíte completa**

Run: `npx vitest run && npx playwright test && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add e2e/comparator.spec.ts
git commit -m "test: e2e do comparador de propostas"
```

---

### Task 8: Verificação final e docs

**Files:**
- Modify: `docs/DEPLOY.md` (nota do comparador)

- [ ] **Step 1: Suite completa + manual**

Run: `npx vitest run && npx playwright test && npm run lint && npm run build`
Testar manualmente no browser: fluxo completo, mobile (cards empilhados), dark mode.

- [ ] **Step 2: Atualizar DEPLOY.md**

Adicionar item no checklist pós-deploy:
```markdown
- [ ] **Comparador** — com conta Ilimitado, comparar 2–3 propostas, conferir ranking, alerta de CET, salvar/reabrir/recalcular e PDF.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOY.md
git commit -m "docs: checklist do comparador no DEPLOY"
```
