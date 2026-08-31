# Formulários, Taxas e Ajuda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir entrada monetária, normalizar três tipos de taxa, adicionar ajuda acessível aos campos autenticados e deixar switches totalmente retos.

**Architecture:** Domínio de taxa fica em módulo puro e toda UI converte para taxa efetiva anual antes de chamar engine. `MoneyInput`, `FieldHelp` e `RateField` concentram contratos compartilhados; telas migram sem alterar fórmulas financeiras.

**Tech Stack:** TypeScript, React 19, Next.js 16.3.3, Base UI/shadcn, Vitest, Playwright, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-30-calculos-formularios-portabilidade-design.md`

## Global Constraints

- Ler documentação relevante em `node_modules/next/dist/docs/` antes de alterar código Next.js.
- `12345678` deve produzir `R$ 123.456,78`.
- Engine recebe taxa efetiva anual em razão decimal.
- CET informado permanece efetivo anual e não recebe seletor nesta versão.
- Ajuda deve funcionar por hover, foco, clique/toque e teclado.
- Trilho e botão interno de todo `Switch` devem usar raio zero.
- Não alterar arquivos não relacionados nem fazer commit sem autorização explícita.

---

### Task 1: Normalização Pura de Taxas

**Files:**
- Create: `src/lib/finance/rates.ts`
- Create: `src/lib/finance/rates.test.ts`

**Interfaces:**
- Produces: `RateKind = 'effective-annual' | 'nominal-annual' | 'effective-monthly'`.
- Produces: `normalizeRate(percent: number, kind: RateKind): { effectiveAnnual: number; effectiveMonthly: number }`.

- [ ] **Step 1: Write failing conversion tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeRate } from './rates';

describe('normalizeRate', () => {
  it('normaliza taxa efetiva anual', () => {
    expect(normalizeRate(10.5, 'effective-annual')).toEqual({
      effectiveAnnual: 0.105,
      effectiveMonthly: expect.closeTo((1.105 ** (1 / 12)) - 1, 12),
    });
  });

  it('converte taxa nominal anual usando nominal/12', () => {
    const result = normalizeRate(12, 'nominal-annual');
    expect(result.effectiveMonthly).toBeCloseTo(0.01, 12);
    expect(result.effectiveAnnual).toBeCloseTo(1.01 ** 12 - 1, 12);
  });

  it('converte taxa efetiva mensal', () => {
    const result = normalizeRate(1, 'effective-monthly');
    expect(result.effectiveMonthly).toBeCloseTo(0.01, 12);
    expect(result.effectiveAnnual).toBeCloseTo(1.01 ** 12 - 1, 12);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejeita %s', (percent) => {
    expect(() => normalizeRate(percent, 'effective-annual')).toThrow(/taxa/i);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/finance/rates.test.ts`

Expected: FAIL because `./rates` does not exist.

- [ ] **Step 3: Implement canonical conversion**

```ts
export type RateKind = 'effective-annual' | 'nominal-annual' | 'effective-monthly';

export function normalizeRate(percent: number, kind: RateKind) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 1200) {
    throw new Error('Informe uma taxa válida.');
  }
  if (kind === 'effective-annual') {
    const effectiveAnnual = percent / 100;
    return { effectiveAnnual, effectiveMonthly: (1 + effectiveAnnual) ** (1 / 12) - 1 };
  }
  const effectiveMonthly = kind === 'nominal-annual' ? percent / 1200 : percent / 100;
  return { effectiveAnnual: (1 + effectiveMonthly) ** 12 - 1, effectiveMonthly };
}
```

- [ ] **Step 4: Run GREEN and full finance tests**

Run: `npx vitest run src/lib/finance/rates.test.ts src/lib/finance/engine.test.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Review diff for unit names and no duplicated annual/monthly conversion.

---

### Task 2: MoneyInput Stable Editing Contract

**Files:**
- Modify: `src/components/ui/money-input.tsx`
- Create: `e2e/money-input.spec.ts`

**Interfaces:**
- Preserves: `MoneyInput({ value: number, onValid: (value: number) => void })`.
- Produces: optional `data-testid` through existing input props.

- [ ] **Step 1: Write RED browser regression**

Add a development-visible usage through existing `/qual-imovel-cabe-no-meu-bolso` page; do not create test-only production route. Test authenticated flow and select the `Renda mensal familiar` input.

```ts
test('MoneyInput não reaproveita zeros da máscara', async ({ page }) => {
  // Use existing cadastro helper and unlock route as established in affordability.spec.ts.
  await page.goto('/qual-imovel-cabe-no-meu-bolso');
  const input = page.getByLabel(/renda mensal familiar/i);
  await input.click();
  await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await input.fill('12345678');
  await expect(input).toHaveValue('123.456,78');
  await input.blur();
  await expect(input).toHaveValue('R$ 123.456,78');
  await input.focus();
  await input.blur();
  await expect(input).toHaveValue('R$ 123.456,78');
});
```

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/money-input.spec.ts`

Expected: FAIL showing duplicated `00` or wrong focused value.

- [ ] **Step 3: Separate editing digits from formatted display**

Implement these rules in `MoneyInput`:

```ts
const valueDigits = value > 0 ? String(Math.round(value * 100)) : '';
const [digits, setDigits] = useState(valueDigits);
const [focused, setFocused] = useState(false);

function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
  setDigits(valueDigits);
  setFocused(true);
  requestAnimationFrame(() => event.currentTarget.select());
}

function handleChange(raw: string) {
  const next = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
  setDigits(next);
  onValid(next ? Number(next) / 100 : 0);
}
```

Do not extract digits from a value initialized with `formatBRL(value)` after focus. Focused display derives only from `digits`; blurred display derives only from `value`.

- [ ] **Step 4: Verify replacement, deletion, paste and focus cycles**

Extend e2e with:

```ts
await input.fill('1');
await expect(input).toHaveValue('0,01');
await input.fill('');
await expect(input).toHaveValue('0,00');
await input.fill('1234');
await expect(input).toHaveValue('12,34');
```

Run: `npx playwright test e2e/money-input.spec.ts e2e/comparator.spec.ts`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Verify public component props remain unchanged and all money call sites still compile.

---

### Task 3: Accessible Field Help and RateField

**Files:**
- Create: `src/components/ui/field-help.tsx`
- Create: `src/components/ui/rate-field.tsx`
- Create: `e2e/field-help.spec.ts`
- Modify: `src/components/ui/tooltip.tsx` only if current primitive cannot support click/touch safely.

**Interfaces:**
- Produces: `FieldHelp({ htmlFor, label, help, children })`.
- Produces: `RateField({ id, value, kind, onValueChange, onKindChange, label })`.
- Consumes: `normalizeRate` and `RateKind` from Task 1.

- [ ] **Step 1: Write RED accessibility test**

```ts
test('ajuda abre por clique e é associada ao campo', async ({ page }) => {
  await page.goto('/nova-simulacao');
  const help = page.getByRole('button', { name: /ajuda sobre taxa/i }).first();
  await help.click();
  await expect(page.getByRole('tooltip')).toContainText(/efetiva/i);
  await help.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
});
```

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/field-help.spec.ts`

Expected: FAIL because help button does not exist.

- [ ] **Step 3: Implement FieldHelp**

Required markup contract:

```tsx
<div className="flex flex-col gap-1.5">
  <div className="flex items-center gap-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger aria-label={`Ajuda sobre ${label}`}>
          <CircleHelp aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent id={`${htmlFor}-help`}>{help}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
  {children}
</div>
```

Use primitive trigger without nesting a `<button>` inside another `<button>`. Confirm Base UI API in installed docs/source before choosing `render`/`asChild` behavior. Ensure touch click toggles content and Escape closes it.

- [ ] **Step 4: Implement RateField with equivalents**

`RateField` renders `FieldHelp`, `NumericInput`, type `Select`, and text:

```ts
const normalized = normalizeRate(value, kind);
const equivalent = `Equivale a ${(normalized.effectiveAnnual * 100).toFixed(2)}% a.a. efetivos e ${(normalized.effectiveMonthly * 100).toFixed(4)}% a.m.`;
```

Invalid transient values omit equivalent instead of throwing during render.

- [ ] **Step 5: Verify component behavior**

Run: `npx playwright test e2e/field-help.spec.ts`

Expected: PASS for mouse/click, keyboard Escape, accessible name and equivalent copy.

---

### Task 4: Persist Rate Kind Through Simulation

**Files:**
- Modify: `src/lib/simulation-context.ts:24-87`
- Modify: `src/components/simulation/WizardForm.tsx`
- Modify: `src/components/simulation/SmartCalculator.tsx`
- Modify: `src/components/simulation/AffordabilityCalculator.tsx`
- Modify: `src/app/(app)/comparar-propostas/types.ts`
- Modify: `src/app/(app)/comparar-propostas/proposal-card.tsx`
- Modify: `src/app/(app)/comparar-propostas/comparator-client.tsx`
- Modify: `src/components/simulation/PortabilityCalculator.tsx`
- Test: existing finance tests plus e2e touched flows.

**Interfaces:**
- Consumes: `RateKind`, `normalizeRate`, `RateField`.
- Produces: `FormState.annualRateKind: RateKind` with default `'effective-annual'`.
- Produces equivalent kind fields in smart, affordability, proposal and portability form state.

- [ ] **Step 1: Write failing FormState conversion test**

Add to a new `src/lib/simulation-context.test.ts`:

```ts
it('normaliza taxa nominal antes de criar LoanInput', () => {
  const input = formToInput({
    ...DEFAULT_FORM,
    annualRate: '12',
    annualRateKind: 'nominal-annual',
  });
  expect(input.annualRate).toBeCloseTo(1.01 ** 12 - 1, 12);
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/simulation-context.test.ts`

Expected: FAIL because `annualRateKind` is absent and conversion assumes effective annual.

- [ ] **Step 3: Add form state kind and backward-safe default**

Add required field to `FormState` and `DEFAULT_FORM`. `parseStoredForm` must merge default so old persisted forms without kind load as effective annual. `formToInput` uses:

```ts
annualRate: normalizeRate(annualRate, f.annualRateKind).effectiveAnnual
```

- [ ] **Step 4: Replace rate inputs with RateField**

For every contractual rate field, keep visual numeric value and kind together. When transferring data to simulator, transfer normalized effective annual and set destination kind to `'effective-annual'` so displayed number matches stored meaning.

Do not give CET field a `RateField`; use `FieldHelp` and label `CET efetivo anual informado (%)`.

- [ ] **Step 5: Add e2e equivalence coverage**

In `e2e/field-help.spec.ts`, select nominal annual, fill `12`, assert equivalent contains approximately `12,68% a.a.` and simulation succeeds.

Run: `npx vitest run src/lib/finance/rates.test.ts src/lib/simulation-context.test.ts && npx playwright test e2e/field-help.spec.ts e2e/flow.spec.ts e2e/comparator.spec.ts`

Expected: PASS.

---

### Task 5: Complete Help Coverage and Straight Switches

**Files:**
- Modify: `src/components/ui/switch.tsx`
- Modify: `src/components/simulation/WizardForm.tsx`
- Modify: `src/components/simulation/SmartCalculator.tsx`
- Modify: `src/components/simulation/AffordabilityCalculator.tsx`
- Modify: `src/components/simulation/StrategyControls.tsx`
- Modify: `src/components/simulation/PortabilityCalculator.tsx`
- Modify: `src/app/(app)/comparar-propostas/proposal-card.tsx`
- Modify: `src/app/(app)/comparar-propostas/comparator-client.tsx`
- Create: `e2e/field-help-coverage.spec.ts`

**Interfaces:**
- Consumes: `FieldHelp` from Task 3.
- Preserves all existing form state contracts except rate kind additions from Task 4.

- [ ] **Step 1: Write RED coverage checks**

Create table-driven e2e that opens each authenticated form and compares visible editable controls with associated help triggers. Exclude action buttons and hidden inputs explicitly.

```ts
for (const route of ['/nova-simulacao', '/qual-imovel-cabe-no-meu-bolso', '/comparar-propostas', '/portabilidade']) {
  await page.goto(route);
  const fields = page.locator('input:visible, [role="combobox"]:visible, [role="switch"]:visible');
  const described = page.locator('[aria-describedby]:visible');
  expect(await described.count()).toBeGreaterThanOrEqual(await fields.count());
}
```

Refine selectors for grouped radio controls so one group help counts once, not each radio.

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/field-help-coverage.spec.ts`

Expected: FAIL listing screens without help coverage.

- [ ] **Step 3: Migrate labels to FieldHelp**

Write unique, plain-language content per concept. Minimum copy must answer one of:

- what value is expected;
- where user finds it;
- how it changes calculation.

Do not use generic text such as “Informe este campo”. Group PRICE/SAC and related radios under one help description.

- [ ] **Step 4: Remove switch radii**

In `switch.tsx`, replace root `rounded-md` and thumb `rounded-[4px]` with `rounded-none`. Preserve dimensions, focus ring, disabled state and transitions.

Add e2e assertion:

```ts
const radius = await page.getByRole('switch').first().evaluate((el) => getComputedStyle(el).borderRadius);
expect(radius).toBe('0px');
```

Also inspect thumb computed style via child locator and assert `0px`.

- [ ] **Step 5: Verify all authenticated forms**

Run: `npx playwright test e2e/field-help-coverage.spec.ts e2e/toggle.spec.ts e2e/affordability.spec.ts e2e/comparator.spec.ts`

Expected: PASS with no nested-button hydration warnings introduced by help triggers.

- [ ] **Step 6: Full checkpoint**

Run: `npx vitest run && npm run lint && npm run build && npm run test:e2e`

Expected: all commands exit 0. Record any preexisting warning separately; do not claim warning-free output if warning remains.
