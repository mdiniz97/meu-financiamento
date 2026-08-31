# Valor Financiável Pela Parcela Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar modo direto por parcela com máximo inicial e máximo seguro para PRICE e SAC na página e modal de imóvel no bolso.

**Architecture:** Cálculo puro retorna resultados por sistema; inversão inicial reutiliza `maxFinancing` e busca segura usa `simulate` como oráculo. Componente reutilizável alterna modos sem duplicar taxa, prazo, seguro e navegação para simulador.

**Tech Stack:** TypeScript, React 19, Next.js 16.3.3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-calculos-formularios-portabilidade-design.md`

## Global Constraints

- Depende de `normalizeRate`, `RateKind`, `RateField` e `FieldHelp` do plano de formulários.
- Renda não é obrigatória no modo `Por parcela`.
- Máximo seguro deve respeitar teto em todas as parcelas, incluindo TR e seguro.
- Não fazer commit sem autorização explícita.

---

### Task 1: Safe Financing Domain

**Files:**
- Modify: `src/lib/finance/smart.ts`
- Create: `src/lib/finance/financing-capacity.ts`
- Create: `src/lib/finance/financing-capacity.test.ts`

**Interfaces:**
- Produces: `calculateFinancingCapacity(input): FinancingCapacityResult`.
- Result systems: `{ initialLimit, safeLimit, initialPayment, peakPayment, peakPaymentMonth }` for `PRICE` and `SAC`.

- [ ] **Step 1: Write RED known-value and safety tests**

```ts
it('retorna máximo inicial e seguro sem ultrapassar teto', () => {
  const result = calculateFinancingCapacity({
    maxPayment: 5000,
    annualRate: 0.105,
    trMonthly: 0.0017,
    insuranceMonthly: 100,
    bank: 'Caixa',
    months: 360,
  });
  for (const system of ['PRICE', 'SAC'] as const) {
    expect(result[system].initialLimit).toBeGreaterThanOrEqual(result[system].safeLimit);
    expect(result[system].peakPayment).toBeLessThanOrEqual(5000.01);
  }
});

it('TR pode tornar máximo seguro menor que máximo inicial', () => {
  const result = calculateFinancingCapacity({ ...base, trMonthly: 0.003 });
  expect(result.PRICE.safeLimit).toBeLessThan(result.PRICE.initialLimit);
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/finance/financing-capacity.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement bounded binary search**

Use direct initial limit as upper bound. For each system, run at most 60 iterations:

```ts
function peakFor(principal: number, system: AmortSystem) {
  const result = simulate({ ...loanInput, principal, system });
  return result.installments.reduce(
    (peak, item, index) => item.parcela > peak.value ? { value: item.parcela, month: index + 1 } : peak,
    { value: 0, month: 0 }
  );
}
```

Move `lo` when peak `<= maxPayment`; move `hi` otherwise. Floor final safe principal to cents and verify final simulation. If rounding exceeds cap, decrement one cent until valid, with maximum two adjustments.

- [ ] **Step 4: Cover zero-rate and fixed-cost edge cases**

Add tests:

```ts
expect(maxFinancing({ ...base, annualRate: 0 }).PRICE).toBe((base.maxPayment - base.insuranceMonthly) * base.months);
expect(calculateFinancingCapacity({ ...base, maxPayment: 50, insuranceMonthly: 100 }).PRICE.safeLimit).toBe(0);
```

Update direct inverse for zero rate using `available * months` rather than returning zero.

- [ ] **Step 5: Verify domain**

Run: `npx vitest run src/lib/finance/financing-capacity.test.ts src/lib/finance/affordability.test.ts src/lib/finance/smart.test.ts`

Expected: PASS.

---

### Task 2: Two Affordability Modes

**Files:**
- Modify: `src/components/simulation/AffordabilityCalculator.tsx`
- Modify: `src/lib/finance/affordability.ts`
- Modify: `src/lib/finance/affordability.test.ts`
- Modify: `e2e/affordability.spec.ts`

**Interfaces:**
- Consumes: `calculateFinancingCapacity`.
- Produces UI mode: `'income' | 'payment'`.
- Preserves `AffordabilityCalculator` use in page and SmartCalculator modal.

- [ ] **Step 1: Write RED e2e for direct mode**

```ts
await page.goto('/qual-imovel-cabe-no-meu-bolso');
await page.getByRole('tab', { name: /por parcela/i }).click();
await expect(page.getByLabel(/renda mensal/i)).toBeHidden();
await page.getByLabel(/parcela máxima/i).fill('500000');
await page.getByRole('button', { name: /calcular valor financiável/i }).click();
await expect(page.getByText(/máximo pela parcela inicial/i).first()).toBeVisible();
await expect(page.getByText(/máximo seguro no contrato/i).first()).toBeVisible();
```

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/affordability.spec.ts`

Expected: FAIL because mode control and result labels are absent.

- [ ] **Step 3: Add accessible two-mode control**

Use existing Tabs component if present; otherwise use two rectangular buttons with `role="tablist"`, `role="tab"`, `aria-selected`, keyboard navigation and `rounded-none` only if established style demands. Mode income keeps existing fields and scenarios. Mode payment shows payment, shared financing fields, optional cash and costs.

- [ ] **Step 4: Render capacity cards**

For each system show both alternatives, peak month/payment and property value when optional down payment exists. `Levar ao simulador` must exist separately for initial and safe alternatives and pass selected principal.

- [ ] **Step 5: Preserve modal callback behavior**

In `SmartCalculator`, callback receives selected system/principal and normalized effective annual rate. Confirm modal remains scrollable on mobile and no state from one mode contaminates other mode.

- [ ] **Step 6: Verify page and modal**

Run: `npx vitest run src/lib/finance/affordability.test.ts src/lib/finance/financing-capacity.test.ts && npx playwright test e2e/affordability.spec.ts`

Expected: PASS.

---

### Task 3: Full Financing Capacity Verification

**Files:**
- Test only previously touched files.

**Interfaces:** None new.

- [ ] **Step 1: Property-style safety cases**

Add table cases across PRICE/SAC, terms 120/240/360 and TR 0/0.17%/0.3%. For every safe result, simulate and assert every installment `<= cap + 0.01`. Simulate safe principal plus R$ 1 and assert either peak exceeds cap or result is within cent-level tolerance.

- [ ] **Step 2: Run finance suite**

Run: `npx vitest run src/lib/finance`

Expected: PASS.

- [ ] **Step 3: Run project verification**

Run: `npm run lint && npm run build && npm run test:e2e`

Expected: all commands exit 0.
