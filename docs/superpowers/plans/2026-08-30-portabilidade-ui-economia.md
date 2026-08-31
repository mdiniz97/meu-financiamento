# Portabilidade UI e Economia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar portabilidade em Dados/Atual/Oferecido e fazer veredito, busca e resultados usarem economia líquida após custos.

**Architecture:** Domínio puro expõe economia bruta, custos e economia líquida. Formulário separa grupos visuais sem mudar contratos do engine; dirty state invalida ações derivadas. Sandbox recebe proposta completa para transferência ao simulador.

**Tech Stack:** TypeScript, React 19, Next.js 16.3.3, Vitest, Playwright, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-30-calculos-formularios-portabilidade-design.md`

## Global Constraints

- Depende de `MoneyInput`, `RateField` e `FieldHelp` do plano de formulários.
- Dados do financiamento ficam acima dos painéis.
- Desktop: Atual e Oferecido lado a lado; mobile: empilhados nessa ordem.
- Veredito e busca usam economia líquida após custos.
- Resultado alterado permanece visível, marcado desatualizado, com ações derivadas bloqueadas.
- Não fazer commit sem autorização explícita.

---

### Task 1: Net Portability Economics

**Files:**
- Modify: `src/lib/finance/portability.ts`
- Modify: `src/lib/finance/portability.test.ts`

**Interfaces:**
- Produces `PortabilityResult.economiaBruta: number`.
- Produces `PortabilityResult.costs: number`.
- Produces `PortabilityResult.economiaLiquida: number`.
- Remove/rename ambiguous `economia` after updating all consumers in later task; do not keep compatibility alias without concrete external consumer.

- [ ] **Step 1: Write RED net-economy tests**

```ts
it('custos podem tornar portabilidade desvantajosa', () => {
  const withoutCosts = comparePortability({ ...base, costs: 0 });
  const withCosts = comparePortability({ ...base, costs: withoutCosts.economiaBruta + 1 });
  expect(withCosts.economiaBruta).toBeGreaterThan(0);
  expect(withCosts.economiaLiquida).toBe(-1);
});

it('busca de taxa usa economia líquida', () => {
  const free = portabilityBreakEven({ ...base, costs: 0 });
  const costly = portabilityBreakEven({ ...base, costs: 50000 });
  expect(costly.maxWorthwhileRate).toBeLessThan(free.maxWorthwhileRate);
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/finance/portability.test.ts`

Expected: FAIL because result has only ambiguous `economia` and break-even ignores costs.

- [ ] **Step 3: Implement net fields**

```ts
const economiaBruta = keep.metrics.totalPago - ported.metrics.totalPago;
const economiaLiquida = economiaBruta - costs;
```

Return explicit fields. Change `portabilityBreakEven` predicate to `economiaLiquida >= 0`.

- [ ] **Step 4: Correct payback edge messages at domain level**

Keep `paybackMonth: null` when cumulative monthly savings never recovers costs. Add tests for costs greater than all cumulative savings and cost zero with lower offered installment.

- [ ] **Step 5: Verify domain**

Run: `npx vitest run src/lib/finance/portability.test.ts src/lib/finance/strategies.test.ts`

Expected: PASS.

---

### Task 2: Portability Form Layout and Validation

**Files:**
- Modify: `src/app/(app)/portabilidade/page.tsx`
- Modify: `src/components/simulation/PortabilityCalculator.tsx`
- Create: `e2e/portability.spec.ts`

**Interfaces:**
- Consumes: net result fields from Task 1 and shared form components.
- Produces stable section markers/headings `Dados do financiamento`, `Contrato atual`, `Proposta oferecida`.

- [ ] **Step 1: Write RED desktop/mobile layout tests**

```ts
test('desktop mostra dados acima e painéis lado a lado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/portabilidade');
  const data = page.getByRole('region', { name: /dados do financiamento/i });
  const current = page.getByRole('region', { name: /contrato atual/i });
  const offered = page.getByRole('region', { name: /proposta oferecida/i });
  expect((await data.boundingBox())!.y).toBeLessThan((await current.boundingBox())!.y);
  expect(Math.abs((await current.boundingBox())!.y - (await offered.boundingBox())!.y)).toBeLessThan(2);
});
```

Mobile test at 390px asserts y order `data < current < offered` and `document.documentElement.scrollWidth === innerWidth`.

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/portability.spec.ts`

Expected: FAIL because current form is one mixed grid without named regions.

- [ ] **Step 3: Expand page container and split sections**

Set page wrapper `max-w-5xl`, responsive padding. Render shared data section first, then `grid gap-4 md:grid-cols-2` containing two semantic regions. Give offered panel subtle primary border/background; do not label it winner.

Use `MoneyInput` for principal, insurance, costs and target payment. Use `RateField` for current/offered rates. Use `FieldHelp` for all remaining inputs and grouped controls.

- [ ] **Step 4: Harden validation**

Wrap domain calls in `try/catch`; show actionable error within correct section. Validate normalized rates and engine bounds before simulate. CTA text exactly `Comparar contrato atual e proposta`.

- [ ] **Step 5: Verify responsive layout and calculation**

Run: `npx playwright test e2e/portability.spec.ts`

Expected: desktop and mobile layout tests pass, calculation remains functional.

---

### Task 3: Dirty Results and Net Result UI

**Files:**
- Modify: `src/components/simulation/PortabilityCalculator.tsx`
- Modify: `src/components/simulation/PortabilitySandbox.tsx`
- Modify: `e2e/portability.spec.ts`

**Interfaces:**
- Produces state `resultDirty: boolean` or equivalent derived revision comparison.
- Consumes explicit net result fields from Task 1.

- [ ] **Step 1: Write RED verdict-cost test**

Fill scenario with positive gross savings, then set costs above gross savings. Calculate and assert:

```ts
await expect(page.getByText(/não vale a pena portar/i)).toBeVisible();
await expect(page.getByText(/economia bruta/i)).toBeVisible();
await expect(page.getByText(/custos/i)).toBeVisible();
await expect(page.getByText(/economia líquida/i)).toContainText('-');
```

- [ ] **Step 2: Write RED dirty-state test**

Calculate, edit offered rate, assert `Dados alterados — calcule novamente` and disabled `Levar para o simulador`. Recalculate and assert warning disappears/action enables.

- [ ] **Step 3: Run RED**

Run: `npx playwright test e2e/portability.spec.ts`

Expected: FAIL because verdict uses gross economy and edits do not mark stale result.

- [ ] **Step 4: Implement result revision tracking**

At successful calculation, store normalized input fingerprint or revision. Every update helper marks result dirty when result exists. Preserve old result. Disable sandbox transfer and any action using result while dirty.

- [ ] **Step 5: Render explicit net breakdown**

Verdict uses `economiaLiquida > 0`. Show gross, costs, net and payback separately. For `paybackMonth === null` with costs, copy says costs are not recovered within simulated term; never claim first-month reduction as payback.

Result panels mirror form panels. Offered total combined equals `ported.metrics.totalPago + costs`.

- [ ] **Step 6: Verify result UX**

Run: `npx vitest run src/lib/finance/portability.test.ts && npx playwright test e2e/portability.spec.ts`

Expected: PASS.

---

### Task 4: Transfer Complete Offered Proposal

**Files:**
- Modify: `src/components/simulation/PortabilityCalculator.tsx`
- Modify: `src/components/simulation/PortabilitySandbox.tsx`
- Modify: `src/components/simulation/NovaSimulacaoClient.tsx` or existing session transfer consumer only if required.
- Modify: `e2e/portability.spec.ts`

**Interfaces:**
- Produces transfer payload containing `principal`, `system`, `bank`, normalized `annualRate`, `trMonthly`, `insuranceMonthly`, `months`.
- Costs are intentionally excluded.

- [ ] **Step 1: Write RED transfer test**

Choose offered SAC, Itaú, custom rate/TR/insurance and click transfer. On `/nova-simulacao`, assert all corresponding fields and system are populated. Assert costs did not change principal.

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/portability.spec.ts -g "transfere proposta completa"`

Expected: FAIL because current transfer sends only principal, rate and months.

- [ ] **Step 3: Implement complete payload**

Use same `FormState`/session transfer contract used elsewhere. Since source rate is normalized, destination sets `annualRateKind: 'effective-annual'` and displays effective annual percent. Include bank, system, TR and insurance.

- [ ] **Step 4: Verify transfer and dirty guard**

Run transfer test once with clean result and once after edit, asserting dirty result cannot transfer.

- [ ] **Step 5: Full verification**

Run: `npx vitest run && npm run lint && npm run build && npm run test:e2e`

Expected: all commands exit 0.
