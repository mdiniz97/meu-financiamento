# Conversão Google Ads após cadastro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar uma conversão Google Ads, no máximo uma vez por conta nova criada em produção, após o navegador autenticado carregar a tag.

**Architecture:** O INSERT de usuário novo recebe um identificador opaco derivado de sequência Postgres; usuários anteriores e logins existentes permanecem sem marca. Uma rota autenticada reserva atomicamente a pendência, e um Client Component chama `gtag` com `event_callback` que confirma a entrega. Reserva vencida permite retry com o mesmo `transaction_id`.

**Tech Stack:** Next.js 16 App Router, React 19, NextAuth JWT, Drizzle/Postgres, Vitest, Playwright, Google tag `gtag.js` já no layout.

**Spec:** `docs/superpowers/specs/2026-09-25-google-ads-cadastro-conversion-design.md`

## Global Constraints

- Disparar apenas para cadastro novo em produção, nunca para login existente, retorno de checkout, assinatura, crédito ou renovação.
- `send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE'`, `value: 1.0`, `currency: 'BRL'`; não enviar preço real, e-mail, CPF, dados financeiros ou ID Asaas.
- Contas antigas ficam com `adsSignupConversionId = NULL`; sem backfill.
- A recusa do PostHog não controla a tag de anúncios; preservar políticas já publicadas.
- Falha de tag, callback ou API de medição não impede cadastro/login; não fabricar transações financeiras para testar.
- `assertSameOrigin()` nas rotas POST, autorização por `auth().userId`, respostas `Cache-Control: no-store`.
- Commit/push de código apenas quando o usuário solicitar explicitamente; não incluir `.opencode/` ou `opencode.jsonc`.

## Review Focus

1. Login Google de conta existente deve retornar sem criar marca nem conversão — teste em Task 1.
2. Dois POSTs de reserva simultâneos devem conceder uma só tentativa — teste em Task 2.
3. Tag bloqueada ou sem callback deve manter pendência para visita futura — teste em Task 3.
4. Cadastro por e-mail em desenvolvimento não deve gerar pendência — teste em Task 1.
5. Usuário antigo após migração, sem `adsSignupConversionId`, deve receber `204` sem conversão — teste em Task 2.

---

### Task 1: Marca de cadastro novo no banco

**Files:**
- Modify: `src/db/schema.ts` (`users`)
- Create: `src/lib/ads/signup-conversion-id.ts`
- Modify: `src/auth.ts` (criação Google dentro da transação existente)
- Modify: `src/app/api/signup/route.ts` (INSERT de e-mail)
- Modify: `src/auth.analytics.test.ts`
- Modify: `src/app/api/signup/route.test.ts`
- Generate: `drizzle/0019_ads_signup_conversion.sql`, `drizzle/meta/0019_snapshot.json`, `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `adsSignupConversionValue(): SQL<string> | undefined` — expressão `nextval` em produção, `undefined` em desenvolvimento/testes; usar spread condicional no `values` dos INSERTs.
- Produces: campos `schema.users.adsSignupConversionId`, `adsSignupClaimToken`, `adsSignupClaimUntil`, `adsSignupSentAt` para Task 2.

- [ ] **Step 1: Write failing auth and signup tests.** Extend the current mocks so `values` is inspected. Google new user (stub `NODE_ENV=production`) must pass a non-undefined SQL expression in `adsSignupConversionId`; existing user must not call `insert`. Email signup in `NODE_ENV=development` must not set that key; if enabled in production, it must. Existing `signup_completed` PostHog event remains unchanged.

```ts
vi.stubEnv('NODE_ENV', 'production');
await signIn()({ user: { email: 'new@example.test' }, account: { provider: 'google' } });
expect(insertedUserValues).toHaveProperty('adsSignupConversionId');
expect(insertedUserValues).not.toHaveProperty('adsSignupSentAt');
```

- [ ] **Step 2: Run RED.** `npm test -- src/auth.analytics.test.ts src/app/api/signup/route.test.ts` — FAIL: user insert has no conversion marker.
- [ ] **Step 3: Add schema + identifier expression.** Add nullable text `ads_signup_conversion_id` (unique), UUID `ads_signup_claim_token`, timestamptz `ads_signup_claim_until`, timestamptz `ads_signup_sent_at`. `adsSignupConversionValue()` returns `sql<string>\`'TID_' || nextval('ads_signup_conversion_seq')::text\`` in production, otherwise `undefined`. At both existing user INSERTs evaluate helper **once**, spread `...(conversionId ? { adsSignupConversionId: conversionId } : {})`. Do not update existing user on Google login.

```ts
// src/lib/ads/signup-conversion-id.ts
import { sql, type SQL } from 'drizzle-orm';

export function adsSignupConversionValue(): SQL<string> | undefined {
  return process.env.NODE_ENV === 'production'
    ? sql<string>`'TID_' || nextval('ads_signup_conversion_seq')::text`
    : undefined;
}

// In src/auth.ts's new Google user INSERT, evaluated exactly once:
const conversionId = adsSignupConversionValue();
const [row] = await tx.insert(schema.users).values({
  name: user.name ?? email.split('@')[0],
  email,
  passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
  ...(conversionId ? { adsSignupConversionId: conversionId } : {}),
}).returning();
// In src/app/api/signup/route.ts, use the same single evaluation and spread
// around its existing name, normalized email, and password hash fields.
```
- [ ] **Step 4: Generate migration, then add sequence DDL.** Run `npx drizzle-kit generate --name=ads_signup_conversion`; inspect generated `0019_ads_signup_conversion.sql` and `0019_snapshot.json`. Insert `CREATE SEQUENCE IF NOT EXISTS "ads_signup_conversion_seq";` before the `ALTER TABLE`, with nullable columns and unique index as generated. Migration must leave old rows NULL and must not update historical users. Run `npm run db:migrate` **only** against verified local DB `localhost:5433`, never production manually; release step handles production.
- [ ] **Step 5: Run GREEN and migration check.** `npm test -- src/auth.analytics.test.ts src/app/api/signup/route.test.ts`; query local `information_schema.columns` and confirm four fields; verify two newly generated IDs differ without creating real users in production.
- [ ] **Step 6: Commit if explicitly requested.** Stage only Task 1 files, migration, and metadata; use `feat(ads): mark new accounts for conversion`.

### Task 2: Reserva e confirmação autenticadas

**Files:**
- Create: `src/lib/ads/signup-conversion-store.ts`
- Create: `src/app/api/ads/signup-conversion/claim/route.ts`
- Create: `src/app/api/ads/signup-conversion/ack/route.ts`
- Create: `src/lib/ads/signup-conversion-store.test.ts`
- Create: `src/app/api/ads/signup-conversion/claim/route.test.ts`
- Create: `src/app/api/ads/signup-conversion/ack/route.test.ts`

**Interfaces:**
- Consumes: Task 1 columns on `schema.users`.
- Produces: `claimSignupConversion(userId: string, now?: Date): Promise<{ transactionId: string; claimToken: string } | null>`.
- Produces: `ackSignupConversion(userId: string, claimToken: string, now?: Date): Promise<boolean>`.
- HTTP: `POST /api/ads/signup-conversion/claim` → `200` with claim or `204`; `POST /api/ads/signup-conversion/ack` body `{ claimToken }` → `200`/`409`.

- [ ] **Step 1: Write failing store tests.** Mock Drizzle's `update().set().where().returning()` boundary. Verify returned claim uses one user ID, stable transaction ID and UUID token; second claim while lease active returns null; expired lease permits a new token with same transaction ID; ack with another user's ID/wrong token returns false; already-sent user returns null.

```ts
const first = await claimSignupConversion('user-1', new Date('2026-09-25T12:00:00Z'));
expect(first).toEqual({ transactionId: 'TID_42', claimToken: expect.any(String) });
expect(await claimSignupConversion('user-1', new Date('2026-09-25T12:01:00Z'))).toBeNull();
```

- [ ] **Step 2: Run RED.** `npm test -- src/lib/ads/signup-conversion-store.test.ts` — FAIL: store module missing.
- [ ] **Step 3: Implement atomic store.** `claimSignupConversion` generates `randomUUID()` and sets `adsSignupClaimUntil = now + 5 minutes` via one conditional `UPDATE users ... WHERE id=userId AND conversionId IS NOT NULL AND sentAt IS NULL AND (claimUntil IS NULL OR claimUntil < now) RETURNING conversionId, claimToken`. `ackSignupConversion` updates `sentAt=now` only when `id=userId`, `claimToken` matches, `sentAt IS NULL`, and claim is unexpired. No input-controlled user ID. Ensure the DB query condition, not a prior SELECT, arbitrates concurrent tabs.

```ts
// src/lib/ads/signup-conversion-store.ts — keep these signatures for routes.
import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull, isNull, lt, gt, or } from 'drizzle-orm';
import { db, schema } from '@/db';

export type SignupClaim = { transactionId: string; claimToken: string };

export async function claimSignupConversion(userId: string, now = new Date()): Promise<SignupClaim | null> {
  const token = randomUUID();
  const [claimed] = await db.update(schema.users)
    .set({ adsSignupClaimToken: token, adsSignupClaimUntil: new Date(now.getTime() + 300_000) })
    .where(and(eq(schema.users.id, userId), isNotNull(schema.users.adsSignupConversionId),
      isNull(schema.users.adsSignupSentAt),
      or(isNull(schema.users.adsSignupClaimUntil), lt(schema.users.adsSignupClaimUntil, now))))
    .returning({ transactionId: schema.users.adsSignupConversionId,
      claimToken: schema.users.adsSignupClaimToken });
  return claimed?.transactionId && claimed.claimToken
    ? { transactionId: claimed.transactionId, claimToken: claimed.claimToken }
    : null;
}

export async function ackSignupConversion(userId: string, claimToken: string, now = new Date()): Promise<boolean> {
  const rows = await db.update(schema.users).set({ adsSignupSentAt: now })
    .where(and(eq(schema.users.id, userId), eq(schema.users.adsSignupClaimToken, claimToken),
      isNull(schema.users.adsSignupSentAt), gt(schema.users.adsSignupClaimUntil, now)))
    .returning({ id: schema.users.id });
  return rows.length === 1;
}
```
- [ ] **Step 4: Run GREEN.** `npm test -- src/lib/ads/signup-conversion-store.test.ts`.
- [ ] **Step 5: Write failing route tests.** Mock `auth`, `assertSameOrigin`, store functions only. For both routes: unauthenticated `401`, cross-origin `403`, `Cache-Control: no-store`. Claim `204` on null (old user); ack malformed UUID `400`, foreign/expired token `409`, valid token `200`.
- [ ] **Step 6: Run RED.** `npm test -- src/app/api/ads/signup-conversion/claim/route.test.ts src/app/api/ads/signup-conversion/ack/route.test.ts` — FAIL: route modules missing.
- [ ] **Step 7: Implement routes.** Read `session.userId`, call `assertSameOrigin()` before mutation, parse only `{claimToken}` for ack, validate UUID format, call store, never return account data or conversion data to anonymous callers. Return `no-store` on all outcomes.

```ts
// claim/route.ts: after same-origin/auth checks, never accept userId in body.
const claim = await claimSignupConversion(session.userId);
return claim
  ? NextResponse.json(claim, { headers: { 'Cache-Control': 'no-store' } })
  : new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

// ack/route.ts: after same-origin/auth and UUID validation.
const acknowledged = await ackSignupConversion(session.userId, body.claimToken);
return NextResponse.json({ acknowledged }, {
  status: acknowledged ? 200 : 409,
  headers: { 'Cache-Control': 'no-store' },
});
```
- [ ] **Step 8: Run GREEN.** Same two route tests; no network call to Google or Asaas.
- [ ] **Step 9: Commit if explicitly requested.** Stage only Task 2 code/tests; `feat(ads): claim signup conversion once`.

### Task 3: Navegador envia `gtag` somente após cadastro novo

**Files:**
- Create: `src/lib/ads/dispatch-signup-conversion.ts`
- Create: `src/lib/ads/dispatch-signup-conversion.test.ts`
- Create: `src/components/google-ads-signup-conversion.tsx`
- Modify: `src/app/layout.tsx`
- Create: `e2e/google-ads-signup-conversion.spec.ts`

**Interfaces:**
- Consumes: Task 2 claim `{ transactionId, claimToken }`, ack body `{ claimToken }`.
- Produces: `dispatchSignupConversion(gtag: ((...args: unknown[]) => void) | undefined, claim: () => Promise<SignupClaim | null>, ack: (token: string) => Promise<void>): Promise<void>`; `SignupClaim = {transactionId: string; claimToken: string}`.
- `GoogleAdsSignupConversion` mounts once in root layout, reruns on `usePathname()` change and makes at most one claim attempt per navigation after `gtag` readiness.

- [ ] **Step 1: Write failing dispatch tests.** With missing `gtag`, claim is not called; null claim never calls `gtag`; real claim calls `gtag('event','conversion',{send_to:'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',value:1.0,currency:'BRL',transaction_id:'TID_42',event_callback})`; ack is not called before callback, only once after callback.

```ts
await dispatchSignupConversion(gtag, claim, ack);
expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({
  send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
  value: 1.0, currency: 'BRL', transaction_id: 'TID_42',
}));
expect(ack).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run RED.** `npm test -- src/lib/ads/dispatch-signup-conversion.test.ts` — FAIL: dispatcher module missing.
- [ ] **Step 3: Implement minimal dispatcher.** Invoke `gtag` with fixed values and callback; guard callback reentry with a local boolean. Don't acknowledge on absent script or absent claim. HTTP errors must be caught at component boundary so navigation/auth isn't affected.

```ts
// src/lib/ads/dispatch-signup-conversion.ts
export type SignupClaim = { transactionId: string; claimToken: string };
export async function dispatchSignupConversion(
  gtag: ((...args: unknown[]) => void) | undefined,
  claim: () => Promise<SignupClaim | null>,
  ack: (token: string) => Promise<void>
): Promise<void> {
  if (!gtag) return;
  const pending = await claim();
  if (!pending) return;
  let acknowledged = false;
  gtag('event', 'conversion', {
    send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
    value: 1.0,
    currency: 'BRL',
    transaction_id: pending.transactionId,
    event_callback: () => {
      if (acknowledged) return;
      acknowledged = true;
      void ack(pending.claimToken);
    },
  });
}
```
- [ ] **Step 4: Run GREEN.** Same Vitest command.
- [ ] **Step 5: Write failing browser test.** In Playwright, stub `/api/ads/signup-conversion/claim` to return one `TID_42` and `/ack` to record calls. Intercept Google script with an empty response (the site's inline `gtag` still queues commands). Verify one conversion queued on a public page and **zero ack** without a Google callback. The dispatcher unit test covers successful callback and absent `gtag`. Avoid real conversion requests.

```ts
test('signup claim queues one conversion but does not ack without callback', async ({ page }) => {
  let claimed = 0;
  let acknowledged = 0;
  await page.route('**/api/ads/signup-conversion/claim', async (route) => {
    claimed++;
    await route.fulfill({ json: { transactionId: 'TID_42', claimToken: 'test-token' } });
  });
  await page.route('**/api/ads/signup-conversion/ack', async (route) => {
    acknowledged++;
    await route.fulfill({ json: { acknowledged: true } });
  });
  await page.route('**/gtag/js*', (route) => route.fulfill({ status: 200, body: '' }));
  await page.goto('/cookies');
  await page.waitForFunction(() =>
    (window as typeof window & { dataLayer?: IArguments[] }).dataLayer
      ?.some((args) => args[0] === 'event' && args[1] === 'conversion')
  );
  expect(claimed).toBe(1);
  expect(acknowledged).toBe(0);
});
```
- [ ] **Step 6: Run RED.** `npx playwright test e2e/google-ads-signup-conversion.spec.ts` — FAIL: component isn't mounted/no request.
- [ ] **Step 7: Mount client tracker.** Wait up to 5 seconds for global `gtag` readiness after `afterInteractive`; post to claim on navigation; call dispatcher; POST ack from callback. No continuous polling, no signup data in URL, no own payment events. Mount in `src/app/layout.tsx` next to existing Google tag; document why PostHog opt-out doesn't control ads tag.

```tsx
// src/components/google-ads-signup-conversion.tsx (excerpt)
'use client';
declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}
const pathname = usePathname();
useEffect(() => {
  let stopped = false;
  async function deliver() {
    for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
      if (typeof window.gtag === 'function') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (stopped || typeof window.gtag !== 'function') return;
    await dispatchSignupConversion(window.gtag, claimFromApi, acknowledgeToApi);
  }
  void deliver().catch(() => {});
  return () => { stopped = true; };
}, [pathname]);
```
- [ ] **Step 8: Run GREEN plus full checks.** Focused Playwright + Vitest, then `npm test`, `npm run lint`, `npm run build`, `git diff --check`. Check that policy texts remain accurate. Expect only pre-existing lint warnings.
- [ ] **Step 9: Commit if explicitly requested.** Stage Task 3 files only; `feat(ads): send confirmed signup conversion`.

## Final Verification

- Confirm all new source/test/migration files are intentional with `git status --short`, `git diff --check`, and generated migration diff.
- Verify auth duplicate login, sandbox/dev, expired claim, adblocked script, two tabs, and callback retry without touching production transactions.
- Recheck Google Ads base tag and static `1.0 BRL` event; Tag Assistant validation with a **genuine new registration** after deployment, never a synthetic payment or replay of a production account.
- Production release uses the existing migration step before serving the new app. Push/deploy only with explicit user permission; Railway has unrelated staged `function-bun` patch that must not be applied.
