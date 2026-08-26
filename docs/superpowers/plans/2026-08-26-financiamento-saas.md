# Financiamento SaaS (Raio X do Financiamento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SaaS em Next.js onde usuário informa dados do financiamento (SAC/PRICE), explora estratégias de amortização em sandbox interativo, e paga por créditos ou assinatura ilimitada.

**Architecture:** Next.js App Router fullstack; motor financeiro em TS puro (src/lib/finance) espelhando fórmulas das planilhas; Postgres + Drizzle; Auth.js (credentials, JWT); pagamento via interface `PaymentProvider` (fake em dev, Stripe/Asaas depois); UI shadcn/ui + Recharts, PT-BR estilo Nubank.

**Tech Stack:** Next.js 15 (App Router, TS strict), Tailwind, shadcn/ui, Recharts, Drizzle ORM + Neon Postgres, Auth.js v5, Vitest, Playwright, Vercel.

**Spec:** docs/superpowers/specs/2026-08-26-financiamento-saas-design.md

## Global Constraints

- Interface 100% PT-BR; dinheiro formatado com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Paleta estilo Nubank: primary `#820AD1`, fundo `#F5F5F5`, cards brancos `rounded-2xl` sombra suave, fonte Inter
- Motor financeiro: TS puro, **sem** bibliotecas de finanças (PMT/IRR implementados à mão)
- Inputs SEMPRE informados pelo usuário: saldo devedor, taxa de juros, seguro, TR, nº parcelas
- Créditos: 1 simulação/sistema = 1 crédito; +2 no cadastro; pacote R$10 = 10 créditos; assinatura R$99,90/mês = ilimitado
- Exclusivo plano ilimitado: toggle PRICE↔SAC no sandbox e exportação PDF
- Golden tests do motor (valores exatos das planilhas):
  - PRICE: principal 100000, taxa 10% a.a. (mensal `((1+0.10)^(1/12))-1`), TR 0.0017, 100 meses, seguro 100 (split 25/75) → parcela 1 = `1554.9210468803735`, juros 1 = `797.4140428903764`, amort 1 = `657.5070039899971`, correção 1 = `170`, valor útil 1 = `487.5070039899971`, %VU = `0.31352524616479965`, saldo pós-1 = `99512.49299601`, total pago = `168784.08716283907`, juros totais = `48371.802285953214`, correção total = `10312.342078659025`, CET real anual = `0.14199141141511284`, quita no mês 100
  - SAC: principal 396000, taxa 10.5% a.a., TR 0.0017, 389 meses, seguro 100 → parcela 1 = `4426.636509331367`, juros 1 = `3308.6416507195418`, amort = `1017.9948586118252`, correção 1 = `673.2`, saldo pós-1 = `395655.20514138817`, total pago = `1415242.8020808485`, juros totais = `814601.5140224394`, correção total = `165744.67625427066`
- Node 20+, TypeScript strict, ESLint + Prettier
- Commits frequentes, mensagens Conventional Commits

---

### Task 1: Scaffold do projeto

**Files:**
- Create: projeto Next.js completo via `create-next-app` na raiz do repo
- Create: `vitest.config.ts`, `src/lib/utils.ts` (helper `formatBRL`)

**Interfaces:**
- Produces: `src/lib/utils.ts` com `export function formatBRL(v: number): string` e `export function parseBRLToNumber(s: string): number`

- [ ] **Step 1: Criar app Next.js na raiz**

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Instalar deps base**

```bash
npm i drizzle-orm @auth/core next-auth@beta @auth/drizzle-adapter recharts
npm i -D drizzle-kit vitest @vitest/coverage-v8 @playwright/test tsx
npx shadcn@latest init -d
npx shadcn@latest add button input card label select table tabs badge separator tooltip dialog
```

- [ ] **Step 3: Configurar vitest + helper de moeda**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

Create `src/lib/utils.ts`:

```ts
export function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function parseBRLToNumber(s: string): number {
  const cleaned = s.replace(/[R$\s.]/g, '').replace(',', '.');
  return Number(cleaned) || 0;
}
```

- [ ] **Step 4: Verificar build + lint**

```bash
npm run build && npm run lint
```

Expected: build ok, lint sem erros.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold nextjs app + vitest + shadcn"
```

---

### Task 2: Motor — tipos, taxa, PMT, IRR

**Files:**
- Create: `src/lib/finance/types.ts`
- Create: `src/lib/finance/engine.ts`
- Test: `src/lib/finance/engine.test.ts`

**Interfaces:**
- Consumes: nada (primeiro task do motor)
- Produces:
  - `src/lib/finance/types.ts`:
    ```ts
    export type AmortSystem = 'SAC' | 'PRICE';
    export interface LoanInput {
      system: AmortSystem;
      principal: number;          // saldo devedor informado pelo usuário
      annualRate: number;         // taxa a.a. efetiva (0.10 = 10%)
      months: number;             // nº parcelas informado pelo usuário
      trMonthly: number;          // correção monetária mensal (0.0017)
      insuranceMonthly: number;   // seguro por parcela em R$ (informado pelo usuário)
      insuranceSplit: { taxPct: number; insurancePct: number }; // ex { 0.25, 0.75 }
      bank: string;
    }
    export interface ExtraPayment { month: number; amount: number } // month 1-based
    export interface Strategies {
      extraLumpSum: ExtraPayment[];      // amortizações pontuais
      extraMonthlyPct?: number;          // 0.05 = 5% a mais na parcela
      fgtsAnnual?: number;               // R$ amortizados todo mês 12, 24, 36...
      reduceMode: 'payment' | 'term';    // default 'term'
      portability?: { annualRate: number; bank: string; insuranceMonthly: number };
    }
    export interface Installment {
      month: number; juros: number; amortizacao: number; seguro: number;
      correcao: number; extra: number; parcela: number; saldo: number;
      valorUtil: number; pctValorUtil: number;
    }
    export interface SimulationMetrics {
      cetRealAnual: number; totalPago: number; totalJuros: number;
      totalAmortizacao: number; totalCorrecao: number; totalSeguro: number;
      dividaAlemDaDivida: number; dividaCai12m: number; dividaCai3a: number;
      saldoZeroAt: number; parcelaPagaDividaPct: number;
    }
    export interface SimulationResult {
      system: AmortSystem; input: LoanInput; strategies: Strategies;
      installments: Installment[]; metrics: SimulationMetrics;
    }
    ```
  - `src/lib/finance/engine.ts`:
    ```ts
    export function convertAnnualToMonthly(annualRate: number): number
    export function pmt(monthlyRate: number, months: number, principal: number): number
    export function irrMonthly(cashFlows: number[]): number  // busca binária, tolerância 1e-9
    ```

- [ ] **Step 1: Escrever tipos + testes que falham**

Create `src/lib/finance/types.ts` com as interfaces acima.

Create `src/lib/finance/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { convertAnnualToMonthly, irrMonthly, pmt } from './engine';

describe('engine formulas', () => {
  it('converte taxa anual para mensal efetiva', () => {
    expect(convertAnnualToMonthly(0.10)).toBeCloseTo(0.007974140428903764, 12);
  });
  it('calcula PMT (parcela constante)', () => {
    expect(pmt(0.007974140428903764, 100, 100000)).toBeCloseTo(1454.9210468803736, 6);
  });
  it('calcula IRR mensal', () => {
    const flow = [-1000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1100];
    expect(irrMonthly(flow)).toBeCloseTo(0.1, 6);
  });
});
```

- [ ] **Step 2: Rodar e ver falha**

Run: `npx vitest run src/lib/finance/engine.test.ts`
Expected: FAIL (engine.ts não existe).

- [ ] **Step 3: Implementar engine.ts**

```ts
import type { LoanInput, SimulationResult, Strategies } from './types';

export function convertAnnualToMonthly(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function pmt(monthlyRate: number, months: number, principal: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function irrMonthly(cashFlows: number[]): number {
  const f = (r: number) => cashFlows.reduce((acc, c, i) => acc + c / Math.pow(1 + r, i), 0);
  let lo = 0, hi = 10; // f(0) < 0 (paga mais que o principal) e f cresce com r
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function simulate(_input: LoanInput, _strategies: Strategies = emptyStrategies()): SimulationResult {
  throw new Error('implementado no Task 3');
}

function emptyStrategies(): Strategies {
  return { extraLumpSum: [], reduceMode: 'term' };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/finance/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance && git commit -m "feat: engine types + pmt/irr/rate conversion"
```

---

### Task 3: Motor — simulação SAC e PRICE base (golden tests)

**Files:**
- Modify: `src/lib/finance/engine.ts`
- Test: `src/lib/finance/simulate.test.ts`

**Interfaces:**
- Consumes: `LoanInput`, `Strategies`, `SimulationResult` (Task 2)
- Produces: `simulate(input, strategies)` completo para cenário base (sem estratégias) — fórmula exata:
  - taxa mensal `m = convertAnnualToMonthly(input.annualRate)`
  - **PRICE**: parcela = `pmt(m, input.months, input.principal) + insuranceMonthly`; juros = `saldo * m`; amort = `min(parcela − juros − seguro, saldo)`; correcao = `saldo * trMonthly`; saldo −= amort
  - **SAC**: amort fixa = `principal / months`; juros = `saldo * m`; parcela = `amort + juros + seguro`; correcao = `saldo * trMonthly`; saldo −= amort
  - valorUtil = `amortizacao − correcao` (+ extras depois); pctValorUtil = `valorUtil / parcela`
  - última parcela: amort = min(amort, saldo) para zerar exatamente
  - CET real anual = `Math.pow(1 + irrMonthly(flows), 12) − 1` com flows `[−parcela, −parcela, ..., −parcela_final]` (1 fluxo por mês até quitar)
  - saldoZeroAt = mês em que saldo ≤ 0

- [ ] **Step 1: Escrever golden tests que falham**

Create `src/lib/finance/simulate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import type { LoanInput } from './types';

const price: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};

const sac: LoanInput = {
  system: 'SAC', principal: 396000, annualRate: 0.105, months: 389,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};

const closeToSheet = (a: number, b: number, band: number) =>
  Math.abs(a - b) < band;

describe('golden: PRICE (mês a mês exato vs planilha)', () => {
  const r = simulate(price, { extraLumpSum: [], reduceMode: 'term' });
  it('parcela 1', () => expect(r.installments[0].parcela).toBeCloseTo(1554.9210468803735, 6));
  it('juros 1', () => expect(r.installments[0].juros).toBeCloseTo(797.4140428903764, 6));
  it('amortização 1', () => expect(r.installments[0].amortizacao).toBeCloseTo(657.5070039899971, 6));
  it('correção 1', () => expect(r.installments[0].correcao).toBeCloseTo(170, 6));
  it('valor útil 1', () => expect(r.installments[0].valorUtil).toBeCloseTo(487.5070039899971, 6));
  it('pct valor útil 1', () => expect(r.installments[0].pctValorUtil).toBeCloseTo(0.31352524616479965, 6));
  it('saldo pós 1', () => expect(r.installments[0].saldo).toBeCloseTo(99512.49299601, 6));
  it('parcela 2 (recalculada)', () => expect(r.installments[1].parcela).toBeCloseTo(1557.41, 1));
  it('saldo pós 2', () => expect(r.installments[1].saldo).toBeCloseTo(99017.78, 1));
});

describe('golden: PRICE (totais, banda vs planilha)', () => {
  const r = simulate(price, { extraLumpSum: [], reduceMode: 'term' });
  // planilha: total 168784.09, juros 48371.80, correção 10312.34, CET 0.14199, quita 101
  // resíduo ~5% no total vem do NPER interno do Excel (parcela > planilha no fim)
  it('total pago', () => expect(closeToSheet(r.metrics.totalPago, 168784.09, 9500)).toBe(true));
  it('juros totais', () => expect(closeToSheet(r.metrics.totalJuros, 48371.80, 200)).toBe(true));
  it('correção total', () => expect(closeToSheet(r.metrics.totalCorrecao, 10312.34, 50)).toBe(true));
  it('CET real anual', () => expect(closeToSheet(r.metrics.cetRealAnual, 0.14199, 0.01)).toBe(true));
  it('quita entre 100 e 110 meses', () => {
    expect(r.metrics.saldoZeroAt).toBeGreaterThanOrEqual(100);
    expect(r.metrics.saldoZeroAt).toBeLessThanOrEqual(110);
  });
});

describe('golden: SAC (mês a mês exato vs planilha)', () => {
  const r = simulate(sac, { extraLumpSum: [], reduceMode: 'term' });
  it('parcela 1', () => expect(r.installments[0].parcela).toBeCloseTo(4426.636509331367, 6));
  it('juros 1', () => expect(r.installments[0].juros).toBeCloseTo(3308.6416507195418, 6));
  it('amortização 1', () => expect(r.installments[0].amortizacao).toBeCloseTo(1017.9948586118252, 6));
  it('amortização 2 (recalculada)', () => expect(r.installments[1].amortizacao).toBeCloseTo(1021.47, 2));
  it('correção 1', () => expect(r.installments[0].correcao).toBeCloseTo(673.2, 6));
  it('saldo pós 1', () => expect(r.installments[0].saldo).toBeCloseTo(395655.20514138817, 6));
});

describe('golden: SAC (totais, banda vs planilha)', () => {
  const r = simulate(sac, { extraLumpSum: [], reduceMode: 'term' });
  // planilha: total 1415242.80, juros 814601.51, correção 165744.68, CET 0.13146, quita 389
  it('total pago', () => expect(closeToSheet(r.metrics.totalPago, 1415242.80, 2000)).toBe(true));
  it('juros totais', () => expect(closeToSheet(r.metrics.totalJuros, 814601.51, 1000)).toBe(true));
  it('correção total', () => expect(closeToSheet(r.metrics.totalCorrecao, 165744.68, 200)).toBe(true));
  it('CET real anual', () => expect(closeToSheet(r.metrics.cetRealAnual, 0.13146, 0.002)).toBe(true));
  it('quita no mês 389', () => expect(r.metrics.saldoZeroAt).toBe(389));
});
```

Fórmulas exatas decodificadas da planilha (não mudar sem revalidar golden):
- taxa mensal efetiva `m = (1 + taxaA.A.)^(1/12) − 1`
- **PRICE**: parcela₁ = `PMT(m, meses, principal) + seguro`; mês t>1: `n = NPER(m, parcela_{t−1} − seguro, saldo − correção)` e `parcela_t = PMT(m, n, saldo) + seguro` (parcela cresce ~0,16%/mês); juros = `saldo × m`; amortização = `min(parcela − juros − seguro, saldo)`
- **SAC**: amortização₁ = `principal/meses`; amortização_t = `min((saldo + correção)/(meses − t + 1), saldo + correção)`; parcela = `amortização + juros + seguro`
- **Correção TR AUMENTA o saldo**: `saldo = max(0, saldo − amortização + correção)`; valor útil = `amortização + extra − correção`; %VU = `valor útil / parcela`
- **CET real anual** = `(1 + IRR([+principal, −parcela₁, −parcela₂, …]))^12 − 1` com IRR mensal por bissecção
- `saldoZeroAt` = último mês com saldo > 0 (planilha mostra "quita em" contando saldo > 10; para SAC = mesma contagem)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/finance/simulate.test.ts`
Expected: FAIL (simulate lança erro).

- [ ] **Step 3: Implementar simulate base**

Em `engine.ts`, substituir o `simulate` stub:

```ts
import type { Installment, LoanInput, SimulationResult, Strategies } from './types';

export function nper(rate: number, payment: number, pv: number): number {
  return -Math.log(1 - (pv * rate) / payment) / Math.log(1 + rate);
}

export function simulate(input: LoanInput, strategies: Strategies): SimulationResult {
  const m = convertAnnualToMonthly(input.annualRate);
  const installments: Installment[] = [];
  let saldo = input.principal;
  let parcelaAnterior = 0;

  for (let month = 1; month <= input.months + 360; month++) {
    if (saldo <= 1e-9) break;
    const juros = saldo * m;
    const correcao = saldo * input.trMonthly;

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      const pagamentoNper = parcelaAnterior > 0 ? parcelaAnterior - input.insuranceMonthly : 0;
      const pvNper = parcelaAnterior > 0 ? saldo - correcao : 0;
      const mesesRestantes = pagamentoNper > 0 ? nper(m, pagamentoNper, pvNper) : input.months;
      parcela = pmt(m, mesesRestantes, saldo) + input.insuranceMonthly;
      amortizacao = Math.min(Math.max(parcela - juros - input.insuranceMonthly, 0), saldo);
    } else {
      amortizacao = month === 1
        ? input.principal / input.months
        : (saldo + correcao) / (input.months - month + 1);
      amortizacao = Math.min(amortizacao, saldo + correcao);
      parcela = amortizacao + juros + input.insuranceMonthly;
    }

    const seguro = input.insuranceMonthly;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;
    parcelaAnterior = parcela;

    const valorUtil = amortizacao - correcao;
    installments.push({
      month, juros, amortizacao, seguro, correcao, extra: 0,
      parcela, saldo, valorUtil,
      pctValorUtil: valorUtil / parcela,
    });
  }

  const flows = [input.principal, ...installments.map((i) => -i.parcela)];
  const cetMensal = irrMonthly(flows);
  const totals = installments.reduce(
    (acc, i) => ({
      totalPago: acc.totalPago + i.parcela,
      totalJuros: acc.totalJuros + i.juros,
      totalAmortizacao: acc.totalAmortizacao + i.amortizacao,
      totalCorrecao: acc.totalCorrecao + i.correcao,
      totalSeguro: acc.totalSeguro + i.seguro,
    }),
    { totalPago: 0, totalJuros: 0, totalAmortizacao: 0, totalCorrecao: 0, totalSeguro: 0 }
  );

  const metrics = {
    ...totals,
    cetRealAnual: Math.pow(1 + cetMensal, 12) - 1,
    dividaAlemDaDivida: totals.totalPago - input.principal,
    dividaCai12m: input.principal - (installments[Math.min(11, installments.length - 1)]?.saldo ?? 0),
    dividaCai3a: input.principal - (installments[Math.min(35, installments.length - 1)]?.saldo ?? 0),
    saldoZeroAt: installments.length,
    parcelaPagaDividaPct: installments[0].amortizacao / input.principal,
  };

  return { system: input.system, input, strategies, installments, metrics };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/finance/simulate.test.ts`
Expected: PASS (todos golden tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance && git commit -m "feat: engine SAC/PRICE base com golden tests das planilhas"
```

---

### Task 4: Motor — estratégias de amortização

**Files:**
- Modify: `src/lib/finance/engine.ts`
- Test: `src/lib/finance/strategies.test.ts`

**Interfaces:**
- Consumes: `simulate` base (Task 3)
- Produces: `simulate` com estratégias ativas:
  - `extraLumpSum`: no mês X, paga `amount` extra além da parcela; se `reduceMode === 'term'` parcela mantém, senão parcela recalculada (PRICE: `pmt(m, mesesRestantes, saldo) + seguro`; SAC: amort = `saldo/mesesRestantes` + juros + seguro)
  - `extraMonthlyPct`: parcela paga = parcela × (1 + pct); excedente vira amortização extra (mantém juros, amortiza o resto)
  - `fgtsAnnual`: no mês 12, 24, 36... amortiza `fgtsAnnual` do saldo
  - `portability`: a partir do mês 1, usar nova taxa `annualRate` e novo seguro; parcela recalculada
  - regra: `extra` (por parcela) = total pago acima de juros+amortização+seguro; `amortizacao` = amortização regular + extra (consolidado no campo `extra` separado, saldo desconta tudo)
  - saldoZeroAt = último mês com saldo > 0

- [ ] **Step 1: Escrever testes de estratégia que falham**

Create `src/lib/finance/strategies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import type { LoanInput, Strategies } from './types';

const input: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const base: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('amortização pontual (lump sum)', () => {
  it('amortizar 10.000 no mês 12 reduz juros totais', () => {
    const comExtra = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 10000 }] });
    const semExtra = simulate(input, base);
    expect(comExtra.metrics.totalJuros).toBeLessThan(semExtra.metrics.totalJuros);
  });
  it('no mês 12 a parcela tem extra de 10.000', () => {
    const r = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 10000 }] });
    expect(r.installments[11].extra).toBeCloseTo(10000, 2);
  });
  it('extra pontual quita antes (term) ou reduz parcela (payment)', () => {
    const term = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 50000 }] });
    expect(term.metrics.saldoZeroAt).toBeLessThan(100);
  });
});

describe('percentual extra mensal', () => {
  it('5% a mais na parcela antecipa quitação', () => {
    const r = simulate(input, { ...base, extraMonthlyPct: 0.05 });
    expect(r.metrics.saldoZeroAt).toBeLessThan(100);
    expect(r.installments[0].extra).toBeGreaterThan(0);
  });
});

describe('FGTS anual', () => {
  it('amortiza FGTS nos meses 12 e 24', () => {
    const r = simulate(input, { ...base, fgtsAnnual: 3000 });
    expect(r.installments[11].extra).toBeCloseTo(3000, 2);
    expect(r.installments[23].extra).toBeCloseTo(3000, 2);
  });
});

describe('modo redução', () => {
  it('reduceMode payment recalcula parcela menor após extra', () => {
    const r = simulate(input, { ...base, extraLumpSum: [{ month: 12, amount: 50000 }], reduceMode: 'payment' });
    const parcelaAntes = r.installments[10].parcela;
    const parcelaDepois = r.installments[12].parcela;
    expect(parcelaDepois).toBeLessThan(parcelaAntes);
  });
});

describe('portabilidade', () => {
  it('recontratar a 8% a.a. reduz parcela e juros', () => {
    const r = simulate(input, { ...base, portability: { annualRate: 0.08, bank: 'Itaú', insuranceMonthly: 100 } });
    expect(r.installments[0].juros).toBeLessThan(simulate(input, base).installments[0].juros);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/finance/strategies.test.ts`
Expected: FAIL (extras não aplicados).

- [ ] **Step 3: Implementar estratégias**

Em `engine.ts`, reescrever `simulate` — mesma recorrência do Task 3, mais extras e modo de redução:

```ts
export function simulate(input: LoanInput, strategies: Strategies): SimulationResult {
  // portabilidade: recontrata do mês 1 com nova taxa e novo seguro
  const m = convertAnnualToMonthly(strategies.portability?.annualRate ?? input.annualRate);
  const seguroMensal = strategies.portability?.insuranceMonthly ?? input.insuranceMonthly;
  const installments: Installment[] = [];
  let saldo = input.principal;
  let parcelaAnterior = 0;
  let modoPayment = false;
  let mesesRestantesFixos = input.months;

  for (let month = 1; month <= input.months + 360; month++) {
    if (saldo <= 1e-9) break;
    const juros = saldo * m;
    const correcao = saldo * input.trMonthly;

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      const pagamentoNper = parcelaAnterior > 0 ? parcelaAnterior - seguroMensal : 0;
      const pvNper = parcelaAnterior > 0 ? saldo - correcao : 0;
      let mesesRestantes = pagamentoNper > 0 ? nper(m, pagamentoNper, pvNper) : input.months;
      if (modoPayment) mesesRestantes = mesesRestantesFixos;
      parcela = pmt(m, mesesRestantes, saldo) + seguroMensal;
      amortizacao = Math.min(Math.max(parcela - juros - seguroMensal, 0), saldo);
    } else {
      amortizacao = month === 1
        ? input.principal / input.months
        : modoPayment
          ? saldo / mesesRestantesFixos
          : (saldo + correcao) / (input.months - month + 1);
      amortizacao = Math.min(amortizacao, saldo + correcao);
      parcela = amortizacao + juros + seguroMensal;
    }

    let extra = 0;
    const pctExtra = parcela * (strategies.extraMonthlyPct ?? 0);
    if (pctExtra > 0) extra += Math.min(pctExtra, Math.max(saldo - amortizacao, 0));
    const lump = strategies.extraLumpSum.find((e) => e.month === month)?.amount ?? 0;
    if (lump > 0) extra += Math.min(lump, Math.max(saldo - amortizacao - extra, 0));
    if (strategies.fgtsAnnual && month % 12 === 0)
      extra += Math.min(strategies.fgtsAnnual, Math.max(saldo - amortizacao - extra, 0));

    parcela += extra;
    amortizacao += extra;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;
    parcelaAnterior = parcela;

    if (strategies.reduceMode === 'payment' && extra > 0 && saldo > 0 && !modoPayment) {
      modoPayment = true;
      mesesRestantesFixos = Math.max(1, Math.round(nper(m, Math.max(parcela - seguroMensal - extra, 1e-9), saldo)));
    }

    const valorUtil = amortizacao - correcao;
    installments.push({
      month, juros, amortizacao, seguro: seguroMensal, correcao, extra,
      parcela, saldo, valorUtil,
      pctValorUtil: valorUtil / parcela,
    });
  }

  const flows = [input.principal, ...installments.map((i) => -i.parcela)];
  const cetMensal = irrMonthly(flows);
  const totals = installments.reduce(
    (acc, i) => ({
      totalPago: acc.totalPago + i.parcela,
      totalJuros: acc.totalJuros + i.juros,
      totalAmortizacao: acc.totalAmortizacao + i.amortizacao,
      totalCorrecao: acc.totalCorrecao + i.correcao,
      totalSeguro: acc.totalSeguro + i.seguro,
    }),
    { totalPago: 0, totalJuros: 0, totalAmortizacao: 0, totalCorrecao: 0, totalSeguro: 0 }
  );

  const metrics = {
    ...totals,
    cetRealAnual: Math.pow(1 + cetMensal, 12) - 1,
    dividaAlemDaDivida: totals.totalPago - input.principal,
    dividaCai12m: input.principal - (installments[Math.min(11, installments.length - 1)]?.saldo ?? 0),
    dividaCai3a: input.principal - (installments[Math.min(35, installments.length - 1)]?.saldo ?? 0),
    saldoZeroAt: installments.length,
    parcelaPagaDividaPct: installments[0].amortizacao / input.principal,
  };

  return { system: input.system, input, strategies, installments, metrics };
}
```

Regras: extra pontual/percentual/FGTS aplicados após juros do mês; parcela paga = juros + amortização + seguro + extra; amortização = amortização regular + extra; saldo desconta tudo e soma correção. `reduceMode: 'term'` = parcela segue a recorrência (quita antes); `'payment'` = após o 1º extra, parcela fixa num patamar menor (nper re-derivado) até quitar.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/finance`
Expected: PASS (golden + estratégias). Corrigir se golden PRICE mudar (parcelaBase recalcula apenas em reduceMode payment; term não altera base).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance && git commit -m "feat: engine estratégias (lump, % mensal, FGTS, redução, portabilidade)"
```

---

### Task 5: Motor — recomendador

**Files:**
- Create: `src/lib/finance/recommend.ts`
- Test: `src/lib/finance/recommend.test.ts`

**Interfaces:**
- Consumes: `simulate` (Task 4), `LoanInput`, `Strategies`
- Produces:
  ```ts
  export interface Recommendation {
    best: SimulationResult;           // menor totalPago; desempate: menor saldoZeroAt
    scenarios: SimulationResult[];    // todos avaliados
  }
  export function recommend(input: LoanInput, strategiesList: Strategies[]): Recommendation
  ```

- [ ] **Step 1: Teste que falha**

Create `src/lib/finance/recommend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { recommend } from './recommend';
import { simulate } from './engine';
import type { LoanInput, Strategies } from './types';

const input: LoanInput = {
  system: 'PRICE', principal: 100000, annualRate: 0.10, months: 100,
  trMonthly: 0.0017, insuranceMonthly: 100, insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 }, bank: 'Caixa',
};
const base: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('recommend', () => {
  it('escolhe cenário com menor total pago', () => {
    const agressivo = { ...base, extraMonthlyPct: 0.10 };
    const r = recommend(input, [base, agressivo]);
    expect(r.best.metrics.totalPago).toBeLessThan(simulate(input, base).metrics.totalPago);
  });
  it('devolve todos os cenários avaliados', () => {
    const r = recommend(input, [base]);
    expect(r.scenarios).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/finance/recommend.test.ts`
Expected: FAIL (recommend não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/finance/recommend.ts`:

```ts
import { simulate } from './engine';
import type { LoanInput, SimulationResult, Strategies } from './types';

export interface Recommendation {
  best: SimulationResult;
  scenarios: SimulationResult[];
}

export function recommend(input: LoanInput, strategiesList: Strategies[]): Recommendation {
  const scenarios = strategiesList.map((s) => simulate(input, s));
  scenarios.sort(
    (a, b) =>
      a.metrics.totalPago - b.metrics.totalPago ||
      a.metrics.saldoZeroAt - b.metrics.saldoZeroAt
  );
  return { best: scenarios[0], scenarios };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/finance/recommend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/recommend.ts src/lib/finance/recommend.test.ts && git commit -m "feat: recomendador de melhor estratégia"
```

---

### Task 6: Banco — schema Drizzle + seeds

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed.ts`
- Create: `docker-compose.yml` (Postgres local p/ dev)

**Interfaces:**
- Produces:
  - `src/db/index.ts`: `export const db: NeonDatabase<typeof schema>`
  - `src/db/schema.ts` tabelas:
    ```ts
    users(id uuid pk, name text, email text unique, passwordHash text, role text default 'user', createdAt)
    packs(id text pk, name text, priceCents int, credits int null, isSubscription boolean) // 'credits10' R$10/10 créditos; 'unlimited' R$99,90/mês
    subscriptions(id uuid pk, userId fk, packId fk, provider text, providerId text, status text, currentPeriodEnd)
    credit_ledger(id uuid pk, userId fk, amount int, kind text /* bonus|purchase|spend */, description text, createdAt)
    simulations(id uuid pk, userId fk, name text, payload jsonb /* LoanInput+Strategies */, result jsonb /* SimulationResult */, system text, creditsSpent int, createdAt)
    ```

- [ ] **Step 1: Escrever schema + config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/financiamento' },
});
```

Create `src/db/schema.ts` com as tabelas acima (uuid default `gen_random_uuid()`, timestamps `now()`). Senha: hash bcrypt (deps: `npm i bcryptjs`).

- [ ] **Step 2: db/index + seed**

Create `src/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export const db = drizzle(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/financiamento', { schema });
export { schema };
```

Create `src/db/seed.ts` inserindo packs:

```ts
import { db } from './index';
import { packs } from './schema';

await db.insert(packs).values([
  { id: 'credits10', name: '10 créditos', priceCents: 1000, credits: 10, isSubscription: false },
  { id: 'unlimited', name: 'Ilimitado', priceCents: 9990, credits: null, isSubscription: true },
]).onConflictDoNothing();
console.log('packs seeded');
```

- [ ] **Step 3: Rodar migration + seed (Postgres local via docker)**

```bash
docker compose up -d db
npx drizzle-kit generate && npx drizzle-kit migrate && npx tsx src/db/seed.ts
```

Expected: tabelas criadas, packs presentes (verificar com `npx drizzle-kit studio` ou psql).

- [ ] **Step 4: Commit**

```bash
git add drizzle.config.ts src/db docker-compose.yml && git commit -m "feat: schema drizzle (users, packs, subscriptions, credit_ledger, simulations)"
```

---

### Task 7: Auth — cadastro com bônus de créditos + login

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/cadastro/page.tsx`
- Create: `src/app/api/signup/route.ts`
- Create: `src/lib/credits.ts`

**Interfaces:**
- Consumes: schema (Task 6)
- Produces:
  - `src/auth.ts`: `export const { handlers, signIn, signOut, auth } = NextAuth(...)` — provider credentials (email+senha), sessão JWT, `jwt` callback injeta `userId`
  - `src/app/api/signup/route.ts`: POST {name,email,password} → cria user (bcrypt hash) + ledger `+2` (kind `bonus`, desc "Bônus de boas-vindas") em transação; retorna 201
  - `src/lib/credits.ts`:
    ```ts
    export async function getCreditBalance(userId: string): Promise<{ credits: number; isUnlimited: boolean }>
    export async function spendCredit(userId: string, simulationId: string): Promise<boolean> // false se saldo insuficiente e não ilimitado
    export async function addCredits(userId: string, amount: number, kind: string, description: string): Promise<void>
    ```
    - `isUnlimited` = assinatura ativa (status `active` e `currentPeriodEnd > now`)

- [ ] **Step 1: Instalar deps auth**

```bash
npm i bcryptjs && npm i -D @types/bcryptjs
```

- [ ] **Step 2: Escrever auth.ts + rotas**

Create `src/auth.ts`:

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import bcrypt from 'bcryptjs';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, (creds.email ?? '').toLowerCase()),
        });
        if (!user) return null;
        const ok = await bcrypt.compare(creds.password ?? '', user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      session.userId = (token.userId as string) ?? session.user?.email ?? '';
      return session;
    },
  },
});
```

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

Create `src/app/api/signup/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Email e senha (mín. 6 caracteres) são obrigatórios' }, { status: 400 });
  }
  const normalized = (email as string).toLowerCase();
  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) });
  if (exists) return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({ name, email: normalized, passwordHash: await bcrypt.hash(password, 10) })
      .returning();
    await tx.insert(schema.credit_ledger).values({
      userId: created.id, amount: 2, kind: 'bonus', description: 'Bônus de boas-vindas',
    });
    return created;
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
```

Create `src/lib/credits.ts`:

```ts
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export async function getCreditBalance(userId: string) {
  const row = await db
    .select({ sum: sql<number>`coalesce(sum(${schema.credit_ledger.amount}), 0)` })
    .from(schema.credit_ledger)
    .where(eq(schema.credit_ledger.userId, userId));
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, 'active'), gt(schema.subscriptions.currentPeriodEnd, new Date())),
  });
  return { credits: row[0].sum, isUnlimited: Boolean(sub) };
}

export async function addCredits(userId: string, amount: number, kind: string, description: string) {
  await db.insert(schema.credit_ledger).values({ userId, amount, kind, description });
}

export async function spendCredit(userId: string, description: string) {
  const { credits, isUnlimited } = await getCreditBalance(userId);
  if (isUnlimited) return true;
  if (credits < 1) return false;
  await db.insert(schema.credit_ledger).values({ userId, amount: -1, kind: 'spend', description });
  return true;
}
```

- [ ] **Step 3: Páginas login/cadastro**

Create `src/app/(auth)/login/page.tsx` e `cadastro/page.tsx` — client components com formulário (email, senha, nome no cadastro), botões shadcn, erros PT-BR, redireciona pra `/nova-simulacao`. Login usa `signIn('credentials', { redirect: false })`, cadastro chama `/api/signup` e depois loga.

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
```

Abrir `/cadastro`, criar conta, conferir ledger +2 (psql). Login/logout funcionando.

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts src/app/api/auth src/app/api/signup src/app/\(auth\) src/lib/credits.ts && git commit -m "feat: auth credentials + cadastro com 2 créditos bônus"
```

---

### Task 8: Sandbox interativo — wizard + resultado + estratégias (UI principal)

**Files:**
- Create: `src/app/(app)/nova-simulacao/page.tsx` (form de entrada)
- Create: `src/app/(app)/simulacao/page.tsx` (sandbox resultado)
- Create: `src/components/simulation/WizardForm.tsx`, `SimulationSandbox.tsx`, `InstallmentTable.tsx`, `MetricsGrid.tsx`, `StrategyControls.tsx`, `ScenarioCompare.tsx`
- Create: `src/lib/simulation-context.ts` (funções puras de UI: montar `LoanInput`/`Strategies` a partir do estado do form)

**Interfaces:**
- Consumes: `simulate`, `recommend` (Tasks 4-5); `getCreditBalance`/`spendCredit` (Task 7)
- Produces:
  - `src/lib/simulation-context.ts`:
    ```ts
    export function formToInput(f: FormState): LoanInput
    export function formToStrategies(f: FormState): Strategies
    export const DEFAULT_FORM: FormState // valor, taxa 10.5, prazo 360, TR 0.17%, seguro 100, split 25/75, banco Caixa, sistema PRICE
    ```
  - Server actions `src/app/(app)/simulacao/actions.ts`: `saveSimulation(input, strategies, result)`, `loadSimulation(id)` (não gasta crédito ao reabrir), `listSimulations()`, `deleteSimulation(id)` — implementadas na Task 10

- [ ] **Step 1: Criar formToInput/formToStrategies + testes**

Create `src/lib/simulation-context.ts` + `src/lib/simulation-context.test.ts`:

```ts
// test
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORM, formToInput, formToStrategies } from './simulation-context';

describe('simulation-context', () => {
  it('converte form para LoanInput com valores padrão', () => {
    const input = formToInput(DEFAULT_FORM);
    expect(input.principal).toBe(1000000);
    expect(input.system).toBe('PRICE');
  });
  it('converte estratégias do form', () => {
    const s = formToStrategies({ ...DEFAULT_FORM, lumpSum: [{ month: 12, amount: 5000 }] });
    expect(s.extraLumpSum).toEqual([{ month: 12, amount: 5000 }]);
  });
});
```

`FormState` (em `simulation-context.ts`): `{ system, principal: string, annualRate: string, months: string, trMonthly: string, insuranceMonthly: string, bank, lumpSum: ExtraPayment[], extraMonthlyPct: string, fgtsAnnual: string, reduceMode, portability: { annualRate: string, bank: string } | null }` — strings no form, convertidas com `parseBRLToNumber` e `Number`.

- [ ] **Step 2: WizardForm (entrada)**

Componente client com shadcn Input/Card/Segment (tabs): seções "Dados do financiamento" (valor, taxa a.a., prazo meses, TR %, seguro R$/mês, banco Select) e "Estratégias" (controles abaixo). Valores formatados BRL com máscara leve (`inputMode="numeric"`). Botão "Simular" → valida (valores > 0, prazo 1–600) → navega `/simulacao?name=` + salva estado em localStorage ou sessionStorage (chave `sim-input`).

- [ ] **Step 3: SimulationSandbox (resultado)**

Client component:
- Carrega input do sessionStorage; roda `simulate` via `useMemo`
- Server action `saveSimulation` registra simulação e gasta 1 crédito por sistema (PRICE e SAC = 2 créditos) **no momento do primeiro cálculo salvo**; se `spendCredit` retorna false → modal "Créditos insuficientes" com link para `/planos`
- Assinante ilimitado: toggle "PRICE ↔ SAC" visível; senão imutável
- Seções: MetricsGrid (CET real, total pago, juros totais, dívida além da dívida, dívida cai 12m, dívida cai 3 anos, parcela paga da dívida %, quita em X meses) → InstallmentTable (mês, parcela, juros, amortização, seguro, correção, saldo) com ScrollArea e max-h — StrategyControls → ScenarioCompare (tabela comparativa de cenários via `recommend`)

- [ ] **Step 4: StrategyControls ("e se")**

Controles client:
- "Amortizar valor no mês" (lump sum: lista de {mês, valor} + botão adicionar)
- "% extra mensal" (0–100, slider + input)
- "FGTS anual" (valor R$)
- "Reduzir parcela" vs "Reduzir prazo" (RadioGroup)
- "Portabilidade" (toggle: nova taxa + novo banco)
- Tudo recalcula ao vivo via useMemo; mostra cards de comparação: parcela atual vs nova, juros totais, quitação, economia

- [ ] **Step 5: Verificar**

```bash
npm run build && npm run lint
```

Manual: rodar dev, simular cenário base, mexer nos controles e conferir números batem com planilha (ex.: PRICE 100k/10%/100m → total R$ 168.784,09).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\) src/components/simulation src/lib/simulation-context.ts && git commit -m "feat: sandbox interativo com wizard, métricas, tabela e estratégias"
```

---

### Task 9: Gráficos (Recharts)

**Files:**
- Create: `src/components/simulation/charts/BalanceChart.tsx`, `InterestAmortChart.tsx`, `CompareChart.tsx`

**Interfaces:**
- Consumes: `SimulationResult` (Task 3)
- Produces: componentes React (client) que renderizam:
  - `BalanceChart`: linha saldo devedor mês a mês (área roxa #820AD1)
  - `InterestAmortChart`: área empilhada juros vs amortização acumulados
  - `CompareChart`: 2 linhas saldo (cenário base vs com estratégia)

- [ ] **Step 1: Implementar BalanceChart**

```tsx
'use client';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '@/lib/utils';

export function BalanceChart({ data }: { data: { month: number; saldo: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <XAxis dataKey="month" tickFormatter={(m) => `m${m}`} />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v) => formatBRL(Number(v))} />
        <Area dataKey="saldo" stroke="#820AD1" fill="#820AD1" fillOpacity={0.2} name="Saldo devedor" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implementar InterestAmortChart e CompareChart**

`InterestAmortChart`: empilha `jurosAcum` e `amortAcum` (derivados do array com reduce). `CompareChart`: props `{ base: number[]; withStrategy: number[] }` → 2 linhas ("Sem estratégia" cinza, "Com estratégia" roxa).

- [ ] **Step 3: Integrar no SimulationSandbox**

Adicionar 3 cards de gráfico entre MetricsGrid e InstallmentTable.

- [ ] **Step 4: Verificar**

```bash
npm run lint && npm run build
```

Manual: gráficos renderizam no sandbox.

- [ ] **Step 5: Commit**

```bash
git add src/components/simulation/charts && git commit -m "feat: gráficos de saldo, juros x amortização e comparação"
```

---

### Task 10: Recomendador UI + histórico de simulações

**Files:**
- Create: `src/components/simulation/RecommendationCard.tsx`
- Create: `src/app/(app)/minhas-simulacoes/page.tsx`, `src/app/(app)/simulacao/actions.ts` (server actions save/load/list/delete)
- Modify: `src/components/simulation/SimulationSandbox.tsx`

**Interfaces:**
- Consumes: `recommend` (Task 5), schema simulations (Task 6), actions Task 8
- Produces:
  - `RecommendationCard`: cartão destacado (borda roxa, badge "Melhor caminho") com estratégia vencedora, economia total em R$, anos a menos (usando `metrics.saldoZeroAt / 12`)
  - `saveSimulation(userId, { name, input, strategies, result })` — insere row; `listSimulations(userId)`; `loadSimulation(id)` (get by id+userId, não gasta crédito); `deleteSimulation(id)`
  - Histórico lista cards com nome, sistema, datas, economia; botão "Abrir" → `/simulacao?id=`

- [ ] **Step 1: Server actions**

Create `src/app/(app)/simulacao/actions.ts` (todas `'use server'`, autenticam via `auth()` e pegam `userId`; payload/result serializados via JSON.stringify no `jsonb`):

```ts
'use server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, schema } from '@/db';

export async function saveSimulation(input: any, strategies: any, result: any) {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  const [row] = await db.insert(schema.simulations).values({
    userId: session.userId, name: `Simulação ${new Date().toLocaleDateString('pt-BR')}`,
    payload: JSON.stringify({ input, strategies }), result: JSON.stringify(result),
    system: input.system, creditsSpent: 1,
  }).returning();
  return { id: row.id };
}

export async function listSimulations() {
  const session = await auth();
  if (!session?.userId) return [];
  return db.select().from(schema.simulations).where(eq(schema.simulations.userId, session.userId)).orderBy(schema.simulations.createdAt).limit(50);
}

export async function loadSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return null;
  return db.query.simulations.findFirst({ where: and(eq(schema.simulations.id, id), eq(schema.simulations.userId, session.userId)) });
}

export async function deleteSimulation(id: string) {
  const session = await auth();
  if (!session?.userId) return;
  await db.delete(schema.simulations).where(and(eq(schema.simulations.id, id), eq(schema.simulations.userId, session.userId)));
  revalidatePath('/minhas-simulacoes');
}
```

- [ ] **Step 2: RecommendationCard**

Componente client: recebe `Recommendation`; renderiza melhor cenário com `formatBRL(totalPago)`, economia `formatBRL(base.totalPago - best.totalPago)`, tempo `(base.saldoZeroAt - best.saldoZeroAt) / 12` anos a menos.

- [ ] **Step 3: Página minhas-simulações**

Server component: `listSimulations()` → grid de cards (nome, sistema badge, data, link abrir/remover).

- [ ] **Step 4: Integrar salvamento no sandbox**

Botão "Salvar simulação" chama `saveSimulation`; ao reabrir por `?id=` chama `loadSimulation` e hidrata o estado (sem gastar crédito).

- [ ] **Step 5: Verificar**

```bash
npm run build && npm run lint
```

Manual: salvar, listar, reabrir, deletar.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/minhas-simulacoes src/app/\(app\)/simulacao/actions.ts src/components/simulation/RecommendationCard.tsx && git commit -m "feat: recomendação + histórico de simulações"
```

---

### Task 11: Pagamentos — interface provider + checkout + webhook (fake em dev)

**Files:**
- Create: `src/lib/payments/types.ts`, `src/lib/payments/fake.ts`, `src/lib/payments/index.ts`
- Create: `src/app/(app)/planos/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/payments/route.ts`

**Interfaces:**
- Consumes: packs/subscriptions/credit_ledger (Task 6), `addCredits` (Task 7)
- Produces:
  - `src/lib/payments/types.ts`:
    ```ts
    export interface PaymentProvider {
      createCheckout(params: { userId: string; packId: string; priceCents: number }): Promise<{ checkoutUrl: string }>;
      verifyWebhook(payload: string, signature: string | null): Promise<{ userId: string; packId: string; providerId: string } | null>;
    }
    export function getPaymentProvider(): PaymentProvider // PAYMENT_PROVIDER=fake|stripe|asaas
    ```
  - `src/lib/payments/fake.ts`: `FakeProvider` — checkoutUrl `/api/webhooks/payments?fake=approve`, verify devolve `{userId, packId, providerId: 'fake_' + Date.now()}`
  - `src/app/api/checkout/route.ts`: autentica, valida pack, `createCheckout` → redirect URL
  - `src/app/api/webhooks/payments/route.ts`: `verifyWebhook` → se pack assinatura: cria/renova `subscriptions` (status active, currentPeriodEnd = now + 30d); se créditos: `addCredits(userId, pack.credits, 'purchase', ...)`
  - `src/lib/payments/stripe.ts` e `asaas.ts`: stubs que lançam `Error('PAYMENT_PROVIDER=stripe ainda não configurado')` — trocados por implementação real quando provider decidido

- [ ] **Step 1: Testes do FakeProvider + routing**

Create `src/lib/payments/payments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPaymentProvider } from './index';
import { FakeProvider } from './fake';

describe('payments', () => {
  it('env PAYMENT_PROVIDER=fake usa FakeProvider', () => {
    process.env.PAYMENT_PROVIDER = 'fake';
    expect(getPaymentProvider()).toBeInstanceOf(FakeProvider);
  });
  it('fake provider devolve checkout url', async () => {
    const p = new FakeProvider();
    const r = await p.createCheckout({ userId: 'u1', packId: 'credits10', priceCents: 1000 });
    expect(r.checkoutUrl).toContain('/api/webhooks/payments');
  });
});
```

- [ ] **Step 2: Implementar types/fake/index/stubs**

Conforme interfaces acima. `getPaymentProvider()`:

```ts
import { FakeProvider } from './fake';
import { StripeProvider } from './stripe';
import { AsaasProvider } from './asaas';
import type { PaymentProvider } from './types';

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? 'fake';
  if (name === 'fake') return new FakeProvider();
  if (name === 'stripe') return new StripeProvider();
  if (name === 'asaas') return new AsaasProvider();
  throw new Error(`PAYMENT_PROVIDER inválido: ${name}`);
}
```

- [ ] **Step 3: Rotas checkout + webhook**

Conforme interfaces. Webhook deve ser idempotente: grava `providerId` único em `subscriptions`/ledger e ignora duplicados.

- [ ] **Step 4: Página planos**

Client component: mostra saldo de créditos (`getCreditBalance`), packs (fetch `packs` do DB), botões "Comprar 10 créditos – R$ 10,00" e "Assinar Ilimitado – R$ 99,90/mês" → POST `/api/checkout` → redirect.

- [ ] **Step 5: Verificar**

```bash
npm run lint && npm run build
```

Manual: comprar pack fake → créditos sobem; assinar → `isUnlimited` true.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payments src/app/api/checkout src/app/api/webhooks src/app/\(app\)/planos && git commit -m "feat: pagamentos com provider interface (fake dev) + checkout + webhook"
```

---

### Task 12: Gating ilimitado — toggle PRICE↔SAC + export PDF

**Files:**
- Create: `src/app/api/pdf/route.ts` (server, autenticado)
- Create: `src/components/simulation/ExportPdfButton.tsx`, `src/lib/pdf/report.tsx`
- Modify: `src/components/simulation/SimulationSandbox.tsx` (toggle)

**Interfaces:**
- Consumes: `simulate` (Task 4), `getCreditBalance` (Task 7), `SimulationResult`
- Produces:
  - `src/app/api/pdf/route.ts`: GET `?result=<JSON encodeURIComponent>` → gera PDF (via `@react-pdf/renderer`) com: cabeçalho, resumo (sistema, valor, taxa, prazo, TR, seguro), métricas, tabela de parcelas (limitada a 360 linhas), recomendação. Rejeita 403 se não ilimitado
  - Toggle no sandbox: visível apenas se `isUnlimited`; alterna `system` e re-simula (useMemo), comparando lado a lado PRICE vs SAC

- [ ] **Step 1: Instalar pdf deps**

```bash
npm i @react-pdf/renderer
```

- [ ] **Step 2: Implementar report + rota**

Create `src/lib/pdf/report.tsx` (componente `ReportDocument` com `Document`/`Page`/`Text`/`View`/`Table`, estilos roxos, textos PT-BR) e `src/app/api/pdf/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { ReportDocument } from '@/lib/pdf/report';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) return NextResponse.json({ error: 'Exportação em PDF é exclusiva do plano Ilimitado' }, { status: 403 });

  const url = new URL(req.url);
  const result = JSON.parse(url.searchParams.get('result') ?? '{}');
  const buffer = await renderToBuffer(React.createElement(ReportDocument, { result }));
  return new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="raio-x-financiamento.pdf"' } });
}
```

- [ ] **Step 3: ExportPdfButton + toggle no sandbox**

`ExportPdfButton` (client): `window.open('/api/pdf?result=' + encodeURIComponent(JSON.stringify(result)))`. Toggle: `if (!isUnlimited) return <Badge>Exclusivo Ilimitado</Badge>`; senão Switch que re-simula.

- [ ] **Step 4: Verificar**

```bash
npm run lint && npm run build
```

Manual: usuário com créditos (sem assinatura) → botão PDF bloqueado com aviso; assinante → PDF baixa.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/pdf src/lib/pdf src/components/simulation/ExportPdfButton.tsx && git commit -m "feat: gating ilimitado (toggle SAC/PRICE + export PDF)"
```

---

### Task 13: Landing page + estética final

**Files:**
- Modify: `src/app/page.tsx`, `src/app/layout.tsx` (font Inter, cor de fundo #F5F5F5, metadata PT-BR)
- Create: `src/components/landing/*` (Hero, HowItWorks, SystemsExplain, PricingPreview, CTA)

**Interfaces:**
- Consumes: nada (marketing estático)
- Produces: landing em PT-BR explicando SAC vs PRICE (com mini-tabela: SAC amortiza desde o início; PRICE parcela constante paga mais juros no início), como funciona em 3 passos, preview de planos (R$10/10 créditos, R$99,90 ilimitado), CTA cadastro

- [ ] **Step 1: Layout global**

Modify `layout.tsx`: fonte Inter via `next/font`, `body` bg `#F5F5F5` text `#1A1A1A`, `metadata.title = 'Raio X do Financiamento'`, `description` PT-BR. Ajustar `tailwind.config`/globals para primary `#820AD1`.

- [ ] **Step 2: Componentes da landing**

Hero (headline PT-BR + CTA), HowItWorks (3 cards: "Informe seus dados", "Veja o Raio X", "Escolha a melhor estratégia"), SystemsExplain (comparação SAC×PRICE com exemplo numérico: PRICE 1.000.000/360 não amortiza; SAC amortiza; na PRICE só amortiza a partir da parcela equivalente a 218 meses), PricingPreview, Footer com @amigodopairico link.

- [ ] **Step 3: Verificar**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/landing && git commit -m "feat: landing page estética brasileira"
```

---

### Task 14: E2E Playwright + CI + envs de produção

**Files:**
- Create: `playwright.config.ts`, `e2e/*.spec.ts`
- Create: `.github/workflows/ci.yml`, `.env.example`

**Interfaces:**
- Consumes: app completo
- Produces: pipeline de CI (lint + vitest + e2e), `.env.example` com `DATABASE_URL`, `AUTH_SECRET`, `PAYMENT_PROVIDER=fake`

- [ ] **Step 1: Config Playwright**

```bash
npx playwright install chromium
```

`playwright.config.ts` com `baseURL: 'http://localhost:3000'`, webServer `npm run dev`.

- [ ] **Step 2: Specs e2e**

Create `e2e/flow.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('cadastro → simular → comprar créditos', async ({ page }) => {
  const email = `user${Date.now()}@teste.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await expect(page).toHaveURL(/nova-simulacao/);

  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/saldo devedor/i).first()).toBeVisible();

  await page.goto('/planos');
  await page.getByRole('button', { name: /10 créditos/i }).click();
  await expect(page.getByText(/créditos/i)).toBeVisible();
});

test('gate ilimitado: PDF bloqueado sem assinatura', async ({ page }) => {
  // login com conta nova, ir pra simulacao, clicar exportar
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Teste2');
  await page.getByLabel('Email').fill(`u${Date.now()}@teste.com`);
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: /criar conta/i }).click();
  await page.goto('/nova-simulacao');
  await page.getByRole('button', { name: /simular/i }).click();
  await expect(page.getByText(/exclusivo/i).first()).toBeVisible();
});
```

- [ ] **Step 3: CI**

`.github/workflows/ci.yml`: jobs lint (`npm run lint`), test (`npm run test`), e2e (com Postgres service container + env `PAYMENT_PROVIDER=fake`, `AUTH_SECRET=test`).

- [ ] **Step 4: .env.example + scripts**

`package.json`: `"test": "vitest run"`, `"test:e2e": "playwright test"`. Create `.env.example` documentando todas as vars.

- [ ] **Step 5: Verificar**

```bash
npm run lint && npm run test && npx playwright test
```

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e .github .env.example && git commit -m "ci: e2e playwright + github actions + envs"
```

---

### Task 15: Deploy Vercel + Neon

**Files:**
- Create: `vercel.json` (opcional), atualizar `.env.example`

**Interfaces:**
- Consumes: tudo
- Produces: app publicável

- [ ] **Step 1: Criar projeto Neon + Vercel**

Documentar em `.env.example` (sem valores reais): `DATABASE_URL` (Neon), `AUTH_SECRET` (`openssl rand -base64 32`), `PAYMENT_PROVIDER=fake` até provider decidido.

- [ ] **Step 2: Configurar Vercel**

`vercel link` + `vercel env add DATABASE_URL` etc.; deploy preview; rodar `npx drizzle-kit migrate` no banco Neon (via `vercel run` ou local apontando pra URL).

- [ ] **Step 3: Verificar deploy**

Deploy de preview funcional: cadastro, simulação, créditos fake.

- [ ] **Step 4: Commit final**

```bash
git add .env.example vercel.json && git commit -m "chore: config deploy vercel + neon"
```

---

## Pós-MVP (fora deste plano)

- Implementação real Stripe ou Asaas (decisão pendente) no `PaymentProvider`
- Refino do modelo de créditos por feature
- Recursos adicionais: notificações, relatório anual de acompanhamento
