# Aporte Recomendado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir escala, arredondamento e substituição do aporte percentual recomendado pelo Raio X.

**Architecture:** Domínio continua emitindo razão decimal; funções puras adaptam razão para pontos percentuais do formulário e convertem linhas para `Strategies`. `StrategyControls` substitui linha percentual existente em vez de criar linha ignorada.

**Tech Stack:** TypeScript, React 19, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-calculos-formularios-portabilidade-design.md`

## Global Constraints

- `0.1417` no domínio deve aparecer como `14,17%` e voltar ao engine como `0.1417`.
- Aplicar recomendação substitui percentual existente pelo total necessário.
- Preservar duas casas ao reidratar.
- Não fazer commit sem autorização explícita.

---

### Task 1: Extract Pure Strategy Row Adapter

**Files:**
- Create: `src/lib/finance/strategy-rows.ts`
- Create: `src/lib/finance/strategy-rows.test.ts`
- Modify: `src/components/simulation/StrategyControls.tsx`

**Interfaces:**
- Produces: `ratioToPercentPoints(ratio: number): number`.
- Produces: `applyRecommendedPercent(rows, ratio): AporteRow[]`.
- Produces or consumes exported `AporteRow` type without React dependency.

- [ ] **Step 1: Write RED unit tests**

```ts
it('converte razão para pontos percentuais com duas casas', () => {
  expect(ratioToPercentPoints(0.1417)).toBe(14.17);
});

it('substitui aporte percentual existente', () => {
  const rows = [{ id: 1, tipo: 'pct', amount: 5, month: 3, every: 12 }];
  const next = applyRecommendedPercent(rows, 0.1417);
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({ id: 1, tipo: 'pct', amount: 14.17, month: 1 });
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/finance/strategy-rows.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement explicit unit boundary**

```ts
export function ratioToPercentPoints(ratio: number) {
  if (!Number.isFinite(ratio) || ratio < 0) throw new Error('Percentual recomendado inválido.');
  return Math.round(ratio * 10_000) / 100;
}
```

`applyRecommendedPercent` finds existing `tipo === 'pct'`, replaces its amount and month with total recommendation/month 1, and filters any duplicate percentage rows. If absent, append one row.

- [ ] **Step 4: Preserve two decimals during deriveRows**

Replace integer rounding with:

```ts
amount: Math.round(strategies.extraMonthlyPct * 10_000) / 100
```

Move pure row conversions to module enough to test without rendering React; avoid moving unrelated simulation display logic.

- [ ] **Step 5: Verify unit round trip**

Test `0.1417 -> 14.17 -> rowsToStrategies -> 0.1417` and run:

`npx vitest run src/lib/finance/strategy-rows.test.ts src/lib/finance/insights.test.ts`

Expected: PASS.

---

### Task 2: Wire Apply Aporte and Prove Financial Effect

**Files:**
- Modify: `src/components/simulation/StrategyControls.tsx:207-238`
- Modify: `e2e/flow.spec.ts` or create `e2e/aporte-recomendado.spec.ts`

**Interfaces:**
- Consumes: `applyRecommendedPercent`.
- Preserves callback contract `onApplyAporteReady(fn: (ratio: number) => void)`.

- [ ] **Step 1: Write RED e2e**

Create simulation matching existing `insights.test.ts` break-even scenario, click `Aplicar aporte`, then assert percent input value is `14.17` or localized `14,17`, not `0.14`.

Also assert resulting first installment has positive useful amortization or debt balance after month one is lower than initial balance.

- [ ] **Step 2: Run RED**

Run: `npx playwright test e2e/aporte-recomendado.spec.ts`

Expected: FAIL with displayed `0.14`.

- [ ] **Step 3: Replace callback implementation**

```ts
onApplyAporteReady((ratio) => {
  updateRows(applyRecommendedPercent(rows, ratio));
});
```

Ensure callback registration follows existing compiler/team pattern and does not add stale closure regressions. If React docs for installed version recommend `useEffectEvent`, read relevant Next/React docs before changing callback lifecycle.

- [ ] **Step 4: Verify existing-percent replacement**

Extend e2e: create 5% line first, click recommendation, assert only one percentage row remains and value equals total recommendation.

- [ ] **Step 5: Full verification**

Run: `npx vitest run && npx playwright test e2e/aporte-recomendado.spec.ts e2e/flow.spec.ts && npm run lint && npm run build`

Expected: all commands exit 0.

---

## Final Fix Wave Report (2026-08-30)

**Status:** ✅ concluído, sem commits (trabalho permanece uncommitted junto ao restante da wave).

### M1 — `fixedPayment.reduceMode` honrado
- **Fix:** `src/lib/finance/engine.ts` — bloco do pagamento fixo agora seta `modoFonte = fp.reduceMode` quando a janela está ativa, alinhado às demais fontes (%, pontual, FGTS, recorrente). Antes o modo da linha "Mensal (total fixo)" era ignorado e o modo global vencia.
- **Testes:** `src/lib/finance/strategies.test.ts` — (a) fixo com `reduceMode: 'payment'` na fonte ativa `paymentApplied: true` (sem modo → false); (b) linha fixa modo term vs payment com `extraMonthlyPct` companheiro produzem `totalPago` e `saldoZeroAt` distintos — prova que o seletor de Modo nas rows é fiel (só aparece quando os modos realmente divergem; standalone em 10% a.a. os totais coincidem por construção do "parcela + aporte = amount", e o seletor honestamente fica oculto).

### M2 — duplicatas de linhas percentuais
- **Fix:** `src/lib/finance/strategy-rows.ts` — novo `dedupePctRows(rows)` (primeira linha `pct` vence, duplicatas descartadas, mesmas referências quando não há duplicata); aplicado em `updateRows` do `StrategyControls.tsx`, então criar/editar para `% extra mensal` com uma linha existente descarta a nova em vez de deixar linha morta que o engine ignora (engine continua com slot único `extraMonthlyPct`).
- **Testes:** `strategy-rows.test.ts` — primeira vence preservando as demais; sem duplicatas mantém referência; engine usa a primeira após dedupe (`extraMonthlyPct`/`StartMonth`/`ReduceMode` corretos); primeira com valor zero também vence (semântica de primeira linha).

### L1 — rename `pct` → `ratio`
- `DebtInsightCard.tsx` (`onApplyAporte?: (ratio) => void`), `StrategyControls.tsx` (`onApplyAporteReady?: (fn: (ratio) => void | null) => void`), `SimulationSandbox.tsx` (ref, `registerApplyAporte` e `onApplyAporte`). Sem mudança de comportamento.

### L5 — clamp de mês de início no prazo (opcional, baixo risco)
- **Fix:** `clampUntilMonths` agora clampa também `month` (> `months` → `months`), junto do `untilMonth` já existente; `clampStrategyUntilMonths` clampa `startMonth` das quatro janelas (pct, FGTS, recorrente, fixo). Mês de início acima do prazo deixava linha morta silenciosa (ex.: pontual no mês 400 de contrato 360 nunca disparava); agora clampa no último mês e aporta.
- **Testes:** `strategy-rows.test.ts` — clamp de month+until juntos; identidade preservada dentro do prazo; legado com start 400 clampa nas quatro janelas; identidade com mês inicial válido.

### Verificação
- `npx vitest run` → 24 files, 424 tests pass.
- `npx tsc --noEmit` → exit 0.
- `npx eslint .` → exit 0 (2 warnings pré-existentes em `comparator-result.tsx`, fora desta wave).
- `npx playwright test e2e/aporte-recomendado.spec.ts` → 6/6 pass (aplica 14,17%; substitui % existente sem duplicado; >100% indisponível; clamp legado 400→360; clamp digitado; webhook fake).

### Preocupações
- M1: standalone, linha fixa modo term vs payment pode ter totais idênticos por construção (outlay fixado em `amount`); o efeito real aparece com fontes companheiras ou na diferença de `paymentApplied`/`saldoZeroAt`. O seletor de Modo reflete isso (oculto quando irrelevante) — comportamento por design, não bug.
- M2: ao mudar uma linha nova para `% extra mensal` com linha percentual existente, a linha nova some (primeira vence) — intencional, espelha `applyRecommendedPercent`.
- L5: linhas com mês inicial clampado mudam de valor silenciosamente na UI (mesmo padrão do clamp de "Até o mês" já aceito).
- Nenhuma mudança em `validateLoanInput` (mês de início sem limite superior continua tolerado; clamp acontece na camada de rows/UI).

---

## Final Close Wave Report (2026-08-30)

**Status:** ✅ concluído, sem commits (trabalho permanece uncommitted junto ao restante da wave).

### B — mês de início além do prazo: linha removida, não deslocada
- **Fix:** `src/lib/finance/strategy-rows.ts` — `clampUntilMonths` agora **remove** linhas com `month > months` (antes clampava no último mês, injetando dinheiro novo silenciosamente no termo); `untilMonth` continua clampado no prazo. `clampStrategyUntilMonths` **remove a janela inteira** quando `startMonth > months` (pct, FGTS, recorrente, fixo) — apagar só o início faria o % disparar do mês 1 (mais dinheiro novo).
- **Fix:** `src/lib/finance/engine.ts` — `validateLoanInput` agora rejeita `month`/`startMonth > input.months` em pontual, pct, recorrente, FGTS e fixo (mensagem "não pode passar do prazo do contrato"), alinhado ao drop da camada UI/rows. Todos os caminhos de `simulate` já passam por `clampStrategyUntilMonths` (SimulationSandbox:75/84/125/319).
- **Testes:** `strategy-rows.test.ts` — rows além do prazo removidas (outras preservadas), início no último mês mantido, identidade dentro do prazo, legado start 400 removido nas quatro janelas, janela com início além e até válido removida, até-mês sem início explícito continua clampando. `validate.test.ts` — start 400 rejeitado por validação e por `simulate` (cinco fontes), start 360 aceito. `e2e/aporte-recomendado.spec.ts` — legado `fixedPaymentStart: '400'` carrega sem linha e sem quebrar; digitar mês 400 remove a linha ao vivo.

### C — modoFonte só vence se a fonte contribuir de verdade
- **Fix:** `src/lib/finance/engine.ts` — bloco do pagamento fixo só seta `modoFonte = fp.reduceMode` quando `fixoEfetivo > 0` (antes, fixo com valor zero ou abaixo da parcela sobrescrevia o modo de outras fontes sem entrar dinheiro). Mesma regra aplicada a FGTS (`fgExtra > 0`) e recorrente (`recExtra > 0`) — mesma armadilha latente. `monthlyAporteActive` exige `fp.amount > 0` para o fixo contar como cobertura mensal (fixo zero não pode sustentar modo payment).
- **Testes:** `strategies.test.ts` — fixo zero + `% extra` com intent payment → `paymentApplied: true` e total idêntico ao sem fixo; fixo abaixo da parcela (sem folga) → pct payment vence; fixo zero inerte no termo (zero extra, quitação igual ao base); FGTS/recorrente zero não mandam no modo.

### D — linhas com valor zero: visíveis, inertes com dica, reconciliáveis
- **Fix:** `strategy-rows.ts` — `rowsToStrategies` mantém linhas com `amount === 0` (pontual, pct, mensal, recorrente, anual); `deriveRows` deriva linha `pct` quando `extraMonthlyPct !== undefined` (inclusive 0), fechando o round-trip; `ratioToPercentPoints(0)` retorna `0` (antes `-0` pelo epsilon de arredondamento). `serialize.ts` aceita `fixedPayment.amount = 0` (snapshot de comparação não recalcula). `engine.ts` aceita `fixedPayment.amount = 0` (aporte inerte, igual ao pontual).
- **Fix:** `StrategyControls.tsx` — linha com `amount <= 0` (exceto SAC) renderiza esmaecida com dica "Valor zero: aporte inativo. Digite um valor para ativar."; continua removível e editável.
- **Testes:** `strategy-rows.test.ts` — rows zero mantidas em `rowsToStrategies` (pontual/fixo), pct-0 deriva + round-trip de fingerprint estável, reconciliação externa preserva pct-0, edição local em outra linha não apaga a linha zero, dedupe com primeira zero reconcilia. `serialize.test.ts` — snapshot com `fixedPayment { amount: 0 }` reutilizado sem recalcular. `e2e/aporte-recomendado.spec.ts` — linha nova mostra a dica de inativo e segue removível.

### Low — rótulo do Raio X alinhado ao botão
- **Fix:** `DebtInsightCard.tsx` — o parentético ao lado do valor agora usa `requiredTotalExtraPct` ("+14,2% total da parcela"), o mesmo valor que o botão "Aplicar aporte" aplica. Antes mostrava `requiredExtraPct` (incremental sobre a parcela atual), que diverge do total quando já existe aporte percentual.

### Verificação
- `npx vitest run` → 24 files, 441 tests pass.
- `npx tsc --noEmit` → exit 0.
- `npx eslint .` → exit 0 (2 warnings pré-existentes em `comparator-result.tsx`, fora desta wave).
- `npx playwright test e2e/aporte-recomendado.spec.ts` → 9/9 pass (4 novos: legado start 400 removido; digitar mês 400 remove linha; linha zero inativa com dica; mais os 6 pré-existentes com a mudança de política).

### Preocupações
- B: linha com mês inicial acima do prazo some da UI sem aviso específico (mesmo padrão aceito dos clamps anteriores; o texto "Nenhuma amortização definida." aparece quando a última linha cai). Opção "inativa com dica" ficou de fora por preferência explícita pelo drop na camada UI/dedup.
- C: janela de pagamento fixo com `amount > 0` mas abaixo da parcela vigente (parcela cresce com TR e ultrapassa o valor fixo) ainda conta como "cobertura mensal" no `monthlyAporteActive` (`fp.amount > 0` é condição necessária, não suficiente) — caso pré-existente, raro, não tratado nesta wave; modo payment segue com a regra de `aporteMensal > 0` no cálculo efetivo.
- D: `formToStrategies` (caminho do formulário legado) continua descartando estratégias de valor zero — o round-trip de linhas zero vale para a camada de rows do `StrategyControls`; cargas legadas com zero não criam linha (comportamento intencional, sem perda porque o formulário nunca persistiu zero).
- Engine agora lança "input inválido" para `startMonth > months` em vez de tolerar: cargas legadas passam pelo clamp antes de `simulate` (SimulationSandbox), então nenhum caminho da UI quebra; chamadas diretas de API com payload antigo passam a ser rejeitadas — alinhado com a política de "sem dinheiro novo silencioso".
- Nenhum commit criado; diff permanece no working tree com o restante da wave.
