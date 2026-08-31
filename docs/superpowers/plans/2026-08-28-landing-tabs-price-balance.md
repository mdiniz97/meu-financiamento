# Landing Tabs + PRICE Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `DashboardPreview` sidebar tabs clickable (4 real content panels instead of 1 static view), and add a genuine PRICE-favoring point to `SystemsExplain` so the SAC/PRICE comparison isn't one-sided.

**Architecture:** `DashboardPreview.tsx` stays a Server Component (computes all data from `simulate()` as plain strings/numbers) and renders a new Client Component, `DashboardTabs.tsx`, which owns the `useState` for the active tab and receives only serializable props (strings) — deliberately avoiding the mistake a prior plan on this repo made and had to fix (passing a function prop, or putting `"use client"` directly on a component that calls `simulate()`, ships the whole finance engine into the landing's client bundle). `SystemsExplain.tsx` gets a one-line data change, no structural change.

**Tech Stack:** Next.js 16 App Router (Server/Client Component split), Tailwind v4, no new dependencies.

## Global Constraints

- No visual token/palette/typography change — reuse the exact classNames already used by the existing table/chart markup.
- `DashboardPreview.tsx` must stay a Server Component (no `"use client"`) — only the new `DashboardTabs.tsx` is a Client Component, and it must receive plain strings/arrays-of-strings as props, never a function.
- No change to `src/lib/finance/engine.ts` or `src/lib/finance/insights.ts`, and no new calls to `simulate()` beyond what's already computed once at `DashboardPreview.tsx`'s module scope.
- `sacPoints` in `SystemsExplain.tsx` is unchanged.
- Every task's touched files must pass `npx eslint <file>` with zero errors before commit.

---

### Task 1: `DashboardPreview` — clickable tabs with 4 real panels

**Files:**
- Create: `src/components/landing/DashboardTabs.tsx`
- Modify: `src/components/landing/DashboardPreview.tsx` (full rewrite)

**Interfaces:**
- Produces: `DashboardTabs` (named export) — Client Component, props `{ sidebarItems: string[]; comparativoRows: Row[]; amortizacaoRows: Row[]; parcelaInicialPrice: string; parcelaInicialSac: string; economiaTotal: string }` where `Row = { label: string; price: string; sac: string }`. Owns `useState<number>` for the active tab index (default `1`, i.e. "Comparativo").
- Consumes (in `DashboardPreview.tsx`): `simulate` from `@/lib/finance/engine`, `LoanInput` from `@/lib/finance/types` — unchanged calls already in the file.

- [ ] **Step 1: Create the Client Component**

Create `src/components/landing/DashboardTabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Row {
  label: string;
  price: string;
  sac: string;
}

interface DashboardTabsProps {
  sidebarItems: string[];
  comparativoRows: Row[];
  amortizacaoRows: Row[];
  parcelaInicialPrice: string;
  parcelaInicialSac: string;
  economiaTotal: string;
}

function ComparisonTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="text-right">PRICE</span>
        <span className="text-right">SAC</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 border-b border-border py-2.5 text-sm last:border-0"
        >
          <span className="text-muted-foreground">{row.label}</span>
          <span className="text-right font-mono tabular-nums">{row.price}</span>
          <span className="text-right font-mono tabular-nums text-primary">{row.sac}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardTabs({
  sidebarItems,
  comparativoRows,
  amortizacaoRows,
  parcelaInicialPrice,
  parcelaInicialSac,
  economiaTotal,
}: DashboardTabsProps) {
  const [active, setActive] = useState(1);

  return (
    <div className="mt-12 grid border border-border sm:grid-cols-[160px_1fr]">
      <div className="hidden flex-col divide-y divide-border border-r border-border sm:flex">
        {sidebarItems.map((item, i) => (
          <button
            key={item}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "p-4 text-left text-xs",
              i === active ? "font-semibold text-primary" : "text-muted-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-6">
        {active === 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Parcela inicial PRICE</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{parcelaInicialPrice}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Parcela inicial SAC</span>
                <span className="font-mono text-lg font-semibold tabular-nums text-primary">{parcelaInicialSac}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Economia total escolhendo certo</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-emerald-600">{economiaTotal}</span>
            </div>
          </div>
        )}

        {active === 1 && <ComparisonTable title="Comparativo SAC × PRICE" rows={comparativoRows} />}

        {active === 2 && <ComparisonTable title="Amortização por mês" rows={amortizacaoRows} />}

        {active === 3 && (
          <svg viewBox="0 0 300 80" className="w-full text-border" aria-hidden="true">
            <polyline
              points="0,8 60,20 120,38 180,54 240,66 300,74"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <polyline
              points="0,6 60,14 120,26 180,42 240,58 300,72"
              fill="none"
              className="text-primary"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `DashboardPreview.tsx` to compute data and delegate to `DashboardTabs`**

Replace the full file:

```tsx
import { simulate } from "@/lib/finance/engine";
import type { LoanInput } from "@/lib/finance/types";
import { DashboardTabs } from "@/components/landing/DashboardTabs";

const input: LoanInput = {
  system: "PRICE", principal: 1000000, annualRate: 0.10, months: 360,
  trMonthly: 0.0017, insuranceMonthly: 0,
  insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: "Caixa",
};
const none = { extraLumpSum: [], reduceMode: "term" as const };
const price = simulate({ ...input, system: "PRICE" }, none);
const sac = simulate({ ...input, system: "SAC" }, none);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const sidebarItems = ["Visão geral", "Comparativo", "Amortização", "Gráficos"];

const comparativoRows = [
  { label: "Parcela inicial", price: brl(price.installments[0].parcela), sac: brl(sac.installments[0].parcela) },
  { label: "Amortização na 1ª parcela", price: brl(price.installments[0].amortizacao), sac: brl(sac.installments[0].amortizacao) },
  { label: "Juros totais em 30 anos", price: brl(price.metrics.totalJuros), sac: brl(sac.metrics.totalJuros) },
];

const amortizacaoMonths = [
  { month: 1, index: 0 },
  { month: 12, index: 11 },
  { month: 60, index: 59 },
  { month: 120, index: 119 },
  { month: 360, index: 359 },
];

const amortizacaoRows = amortizacaoMonths.map(({ month, index }) => ({
  label: `Mês ${month}`,
  price: brl(price.installments[index].amortizacao),
  sac: brl(sac.installments[index].amortizacao),
}));

const parcelaInicialPrice = brl(price.installments[0].parcela);
const parcelaInicialSac = brl(sac.installments[0].parcela);
const economiaTotal = brl(price.metrics.totalJuros - sac.metrics.totalJuros);

export function DashboardPreview() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Veja o que você encontra na análise completa
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Gráficos de evolução da dívida, tabela de amortização comparativa e o
            break-even entre SAC e PRICE — tudo em um só lugar.
          </p>
        </div>

        <DashboardTabs
          sidebarItems={sidebarItems}
          comparativoRows={comparativoRows}
          amortizacaoRows={amortizacaoRows}
          parcelaInicialPrice={parcelaInicialPrice}
          parcelaInicialSac={parcelaInicialSac}
          economiaTotal={economiaTotal}
        />
      </div>
    </section>
  );
}
```

Note: `installments[359]` is the 360th (last) installment for a 360-month loan — same 0-based indexing pattern already used elsewhere in this codebase (e.g. `SystemsExplain.tsx` uses `installments[59]` for "after 5 years"). `months: 360` in `input` guarantees this index exists.

- [ ] **Step 3: Verify**

Run: `npx eslint src/components/landing/DashboardTabs.tsx src/components/landing/DashboardPreview.tsx && grep -n "use client" src/components/landing/DashboardPreview.tsx`
Expected: eslint passes; grep on `DashboardPreview.tsx` prints nothing (confirms it stayed a Server Component).

Run: `grep -n "use client" src/components/landing/DashboardTabs.tsx`
Expected: one match, on line 1.

- [ ] **Step 4: Confirm the finance engine itself is untouched**

Run: `npx vitest run src/lib/finance --silent 2>&1 | tail -5`
Expected: same pass count as before this plan.

- [ ] **Step 5: Confirm the finance engine did not leak into the landing's client bundle**

Run: `npm run build`, then check that none of the client JS chunks referenced by the `/` route contain the finance engine (spot-check: `grep -rl "convertAnnualToMonthly" .next/static/chunks/*.js` — if any hit shows up, check whether that chunk is actually referenced by `/`'s `index.html`/`index.rsc`, the same verification method used in a prior plan on this repo; it's fine if the engine appears in chunks for OTHER routes like `/nova-simulacao`, just not in `/`'s own chunk graph).
Expected: no engine code in any chunk the `/` route loads.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/DashboardTabs.tsx src/components/landing/DashboardPreview.tsx
git commit -m "feat: make DashboardPreview sidebar tabs clickable with real content per tab"
```

---

### Task 2: `SystemsExplain` — add a PRICE-favoring point

**Files:**
- Modify: `src/components/landing/SystemsExplain.tsx`

- [ ] **Step 1: Add the new point to `pricePoints`, as the first item**

Change:

```tsx
const pricePoints = [
  "Parcela igual do início ao fim",
  "No começo, quase tudo é juro e a amortização é mínima",
  `No exemplo abaixo, a dívida até cresce nos primeiros anos (por causa da TR)`,
  `Só passa a amortizar de verdade a partir da ~${be.maxMonths}ª parcela (mais de 18 anos)`,
];
```

to:

```tsx
const pricePoints = [
  "Parcela inicial menor que o SAC — mais fácil de caber no orçamento e na aprovação do crédito",
  "Parcela igual do início ao fim",
  "No começo, quase tudo é juro e a amortização é mínima",
  `No exemplo abaixo, a dívida até cresce nos primeiros anos (por causa da TR)`,
  `Só passa a amortizar de verdade a partir da ~${be.maxMonths}ª parcela (mais de 18 anos)`,
];
```

Nothing else in the file changes — `sacPoints`, the JSX rendering `pricePoints.map(...)`, and everything else stays exactly as-is.

- [ ] **Step 2: Verify**

Run: `npx eslint src/components/landing/SystemsExplain.tsx && grep -n "Parcela inicial menor" src/components/landing/SystemsExplain.tsx`
Expected: eslint passes; grep shows the new line.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/SystemsExplain.tsx
git commit -m "content: add PRICE-favoring point to balance the SAC/PRICE comparison"
```

---

### Task 3: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Lint the whole repo**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Unit tests**

Run: `npm test`
Expected: same pass count as before this plan (120 tests).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds; `/` still statically prerendered.

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000`.
- In the "Veja o que você encontra na análise completa" section, click each of the 4 sidebar items ("Visão geral", "Comparativo", "Amortização", "Gráficos") and confirm the panel on the right changes each time, and the active item is visually highlighted (bold + primary color).
- Confirm "Comparativo" is the default active tab on page load (matches the current pre-existing behavior).
- In the "SAC vs PRICE: a diferença custa caro" section, confirm the PRICE column's first bullet is now "Parcela inicial menor que o SAC — mais fácil de caber no orçamento e na aprovação do crédito", followed by the 4 pre-existing points, unchanged.
- Confirm nothing else on the page moved/changed visually.

- [ ] **Step 6: Final commit (if any cleanup was needed)**

If steps 1–5 required fixes, commit them individually with descriptive messages. If everything passed clean, there is nothing to commit here.
