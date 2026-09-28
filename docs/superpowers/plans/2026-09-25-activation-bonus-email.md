# Incentivo único de +2 créditos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar no máximo um incentivo de +2 créditos a cada conta elegível e permitir resgate sem prazo somente pela conta destinatária.

**Architecture:** Cron horário escolhe contas com pelo menos 24h, prioriza novas e percorre históricas em lotes, registra tentativa antes de enviar e-mail, com unicidade por usuário. Link traz token aleatório guardado só como hash; rota de entrada limpa URL e guarda token em cookie HttpOnly curto. Resgate autenticado marca oferta e credita ledger na mesma transação.

**Tech Stack:** Next.js 16 App Router, React 19, NextAuth JWT, Drizzle/Postgres, Resend via `fetch`, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-activation-bonus-email-design.md`

## Global Constraints

- +2 créditos extras por conta além dos 5 de boas-vindas no cadastro; envio único após 24h, inclusive contas históricas em lotes.
- Excluir quem tem Ilimitado ativo no momento de avaliação; zero/uma+ simulações **salvas** escolhem texto.
- Link sem prazo e de uso único; outra conta logada nunca recebe crédito nem consome oferta.
- Guardar só SHA-256 do token aleatório de 32 bytes; não expor token a scripts, logs nem terceiros.
- Registrar tentativa **antes** de chamar provedor; se falha/resultado incerto, não retentar automaticamente para preservar at-most-once.
- Controle de recusa de ofertas não interrompe e-mails operacionais; não enviar e-mails reais em testes.
- Sem `ACTIVATION_BONUS_START_AT` RFC3339 ou `EMAIL_ENABLED`, cron falha fechado/sem envio; não ativar cron Railway sem autorização de deploy.
- Commits/push apenas quando pedidos; `.opencode/`, `opencode.jsonc` e patch Railway `function-bun` pertencem a outro trabalho.

## Review Focus

1. Bot de e-mail pré-carrega link por GET: zero créditos até POST autenticado — Task 4.
2. Token de A aberto em sessão B: zero créditos e A ainda pode usar — Task 4.
3. Timeout do provedor após aceite incerto: não repetir API de envio — Task 3.
4. Dois crons e dois resgates em paralelo: uma tentativa de e-mail e um lançamento de +2 — Tasks 3/4.
5. Contas antigas no backfill não atrasam cadastros novos com 24h — Task 3.

---

### Task 1: Corrigir rodapé duplicado e renderizar as duas variantes

**Files:**
- Modify: `src/lib/email/layout.ts:106-112`
- Modify: `src/lib/email/layout.test.ts`
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/email/templates.test.ts`

**Interfaces:** Produz `activationBonusEmail({ name, variant, redeemUrl, preferencesUrl }): RenderedEmail` para Task 3; `variant` é `'first_simulation' | 'keep_exploring'`.

- [ ] **Step 1: Write failing render tests.** `welcomeEmail(...).html` contém somente uma frase iniciada por “Você recebeu este e-mail”; dunning preserva seu `footerNote`; textos `first_simulation` e `keep_exploring` são distintos, incluem +2 créditos e URL HTML escapada + URL texto, sem detalhes financeiros.

```ts
const welcome = welcomeEmail({ name: 'Ana', credits: 2 });
expect((welcome.html.match(/Você recebeu este e-mail/g) ?? [])).toHaveLength(1);
const offer = activationBonusEmail({ name: 'Ana', variant: 'first_simulation',
  redeemUrl: 'https://amortiza.me/resgatar/link?t=test-token', preferencesUrl: 'https://amortiza.me/perfil' });
expect(offer.text).toContain('2 créditos');
expect(offer.text).toContain('/resgatar/link?t=test-token');
```

- [ ] **Step 2: RED.** `npm test -- src/lib/email/layout.test.ts src/lib/email/templates.test.ts` — frase duplicada / template ausente.
- [ ] **Step 3: GREEN implementation.** Remover somente parágrafo genérico `Você recebeu este e-mail porque tem uma conta...` de `renderEmailLayout`, manter `footerNote`. Nova `activationBonusEmail` usa `renderEmailLayout({ preheader, title, contentHtml, cta, footerNote })`; variantes mencionam simulação salva ou convite inicial; escape via `escapeHtml` e `emailButton` existentes. Texto inclui `redeemUrl` e preferência; nunca colocar token em log.

```ts
export type ActivationVariant = 'first_simulation' | 'keep_exploring';
export function activationBonusEmail(input: {
  name: string; variant: ActivationVariant; redeemUrl: string; preferencesUrl: string;
}): RenderedEmail {
  const intro = input.variant === 'first_simulation'
    ? 'Você ainda não salvou uma simulação. Explore a plataforma com mais 2 créditos.'
    : 'Você já fez simulações. Continue explorando com mais 2 créditos.';
  return { subject: 'Mais 2 créditos para suas simulações',
    html: renderEmailLayout({ title: 'Mais 2 créditos para você',
      contentHtml: `<p>Olá, ${escapeHtml(input.name.trim().split(/\s+/)[0])}.</p><p>${escapeHtml(intro)}</p><p>Seus créditos não expiram.</p>`,
      cta: { label: 'Resgatar 2 créditos', url: input.redeemUrl },
      footerNote: 'Oferta única de ativação para sua conta.' }),
    text: `${intro}\nResgatar: ${input.redeemUrl}\nPreferências: ${input.preferencesUrl}` };
}
```

- [ ] **Step 4: Verify.** Repetir testes focados; nenhum envio real.

### Task 2: Persistência de oferta, token e preferência

**Files:**
- Modify: `src/db/schema.ts`
- Generate: `drizzle/0020_activation_bonus.sql`, `drizzle/meta/0020_snapshot.json`, `drizzle/meta/_journal.json` com `npx drizzle-kit generate --name=activation_bonus`
- Create: `src/lib/activation-bonus/token.ts`
- Create: `src/lib/activation-bonus/token.test.ts`

**Interfaces:** Produz `schema.activationBonusOffers`, `schema.users.activationBonusOptOutAt`; `createActivationToken(): { token: string; hash: string }`; `hashActivationToken(raw: string): string | null`.

- [ ] **Step 1: RED token tests.** Token base64url tem 43 caracteres, dois tokens diferem, hash é SHA-256 hexadecimal de 64 caracteres e não revela token; comprimento/alfabeto inválido retorna null.

```ts
const { token, hash } = createActivationToken();
expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
expect(hashActivationToken(token)).toBe(hash);
expect(hashActivationToken('short')).toBeNull();
```

- [ ] **Step 2: RED.** `npm test -- src/lib/activation-bonus/token.test.ts` — módulo ausente.
- [ ] **Step 3: GREEN token + schema.** Usar `randomBytes(32).toString('base64url')` e `createHash('sha256').update(token).digest('hex')`. `activation_bonus_offers` com `id uuid pk defaultRandom`, `userId uuid notNull unique references users onDelete cascade`, `state text notNull`, `variant text`, `tokenHash text unique nullable`, `emailAttemptedAt timestamptz`, `redeemedAt timestamptz`, `createdAt timestamptz defaultNow`. `users.activationBonusOptOutAt timestamptz` nullable. Sem default de oferta retroativa.

```ts
export function hashActivationToken(raw: string): string | null {
  return /^[A-Za-z0-9_-]{43}$/.test(raw)
    ? createHash('sha256').update(raw).digest('hex') : null;
}
export function createActivationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashActivationToken(token)! };
}
```

- [ ] **Step 4: Verify migration.** Revisar SQL gerado: tabela/índices únicos, coluna nullable e sem UPDATE de contas antigas. Aplicar `npm run db:migrate` só no Postgres local depois de verificar `DATABASE_URL*` aponta para `localhost:5433`; conferir colunas/índices. Rodar teste token.

### Task 3: Cron idempotente e envio at-most-once

**Files:**
- Create: `src/lib/activation-bonus/send.ts`
- Create: `src/lib/activation-bonus/send.test.ts`
- Create: `src/app/api/cron/activation-bonus/route.ts`
- Create: `src/app/api/cron/activation-bonus/route.test.ts`
- Modify: `src/lib/email/client.ts` somente se necessário para headers de descadastro (não inserir outro serviço).

**Interfaces:** Consome schema Task 2 e template Task 1. Produz `runActivationBonus(now = new Date()): Promise<{attempted:number; skipped:number; failed:number}>`; rota usa `isAuthorizedCronRequest` e responde contagens agregadas.

- [ ] **Step 1: RED tests de elegibilidade/concorrência.** Com clock injetado: cadastro 23h59 não entra; 24h entra; 20 novos +30 históricos no máximo; simulações salvas escolhem variante; `hasActiveAccess` true grava `skipped_unlimited` sem envio; opt-out ou `EMAIL_ENABLED=false` não cria oferta. Dois jobs sobre mesmo usuário: somente INSERT vencedor de `userId UNIQUE` envia. Falha `sendEmail` após reserva não causa segundo POST na rodada seguinte. Testar configuração `ACTIVATION_BONUS_START_AT` ausente/inválida → 0 e-mails.

```ts
const first = await runActivationBonus(new Date('2026-09-25T12:00:00Z'));
const second = await runActivationBonus(new Date('2026-09-25T13:00:00Z'));
expect(first.attempted).toBe(1);
expect(second.attempted).toBe(0);
expect(sendEmail).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: RED.** `npm test -- src/lib/activation-bonus/send.test.ts src/app/api/cron/activation-bonus/route.test.ts` — módulos ausentes.
- [ ] **Step 3: GREEN scheduler.** Validar env e `isEmailEnabled` antes de buscar usuários. Consultar `users.createdAt <= now-24h`, opt-out NULL, nenhuma oferta; duas consultas ordenadas para até 20 criados >= START_AT e até 30 anteriores. Por candidato revalidar opt-out/Ilimitado/simulações; inserir oferta com `onConflictDoNothing({target:userId}).returning()`; se não retornar, não enviar. Oferta Ilimitado é `skipped_unlimited`, sem token; oferta elegível gera token Task 2, registra `attempted` e `emailAttemptedAt` antes de chamar `sendEmail`. Escolher template Task 1, enviar uma vez, capturar falha sem reabrir oferta. Não logar URL nem token. Cron usa mesmo auth de `/api/cron/dunning`.

```ts
// A decisão de envio vem do INSERT vencedor, nunca do SELECT inicial.
const [reserved] = await db.insert(schema.activationBonusOffers).values({
  userId: user.id, state: 'attempted', variant,
  tokenHash: hash, emailAttemptedAt: now,
}).onConflictDoNothing({ target: schema.activationBonusOffers.userId })
  .returning({ id: schema.activationBonusOffers.id });
if (!reserved) continue;
try { await sendEmail({ to: user.email, ...activationBonusEmail({
  name: user.name, variant, redeemUrl: `${appUrl}/resgatar/link?t=${token}`,
  preferencesUrl: `${appUrl}/perfil`,
}) }); } catch { failed++; }
```

- [ ] **Step 4: Verify.** Testes focados e probe local com `sendEmail` mockado; não chamar Resend real. Documentar se 50 envios/h excedem timeout da rota; caso excedam, reduzir lotes via revisão da spec antes de ativar produção.

### Task 4: Entrada limpa e resgate autenticado único

**Files:**
- Create: `src/app/resgatar/link/route.ts`
- Create: `src/app/resgatar/page.tsx`
- Create: `src/app/api/activation-bonus/redeem/route.ts`
- Create: `src/lib/activation-bonus/redeem.ts`
- Create: `src/lib/activation-bonus/redeem.test.ts`
- Create: `src/app/api/activation-bonus/redeem/route.test.ts`
- Create: `e2e/activation-bonus.spec.ts`

**Interfaces:** Consome `hashActivationToken`, tabela Task 2 e `auth().userId`; `redeemActivationBonus({ userId, token, now }): Promise<'redeemed' | 'already_redeemed' | 'invalid'>`.

- [ ] **Step 1: RED testes.** GET `/resgatar/link?t=<válido>` retorna 303 para `/resgatar` e cookie HttpOnly/Lax/15min; não credita. Token inválido → URL limpa, sem cookie. POST sem login/Origin válido/sem cookie falha. Token A sob sessão B → `invalid` e zero crédito; A depois → `redeemed`, ledger +2 uma vez; dois POST A concorrentes → um `redeemed`, outro `already_redeemed`, saldo +2 total; token sem TTL continua válido meses depois.

```ts
expect(await redeemActivationBonus({ userId: userB, token: tokenA, now })).toBe('invalid');
expect(await redeemActivationBonus({ userId: userA, token: tokenA, now })).toBe('redeemed');
expect(await redeemActivationBonus({ userId: userA, token: tokenA, now })).toBe('already_redeemed');
```

- [ ] **Step 2: RED.** `npm test -- src/lib/activation-bonus/redeem.test.ts src/app/api/activation-bonus/redeem/route.test.ts` e `npx playwright test e2e/activation-bonus.spec.ts` — módulos/página ausentes.
- [ ] **Step 3: GREEN entrega segura.** Route Handler `GET /resgatar/link` lê query uma vez, `hashActivationToken` só valida formato; `NextResponse.redirect(new URL('/resgatar', APP_URL), 303)` com `Referrer-Policy:no-referrer`, cookie host-only `activation_bonus_token` HttpOnly, SameSite Lax, Secure produção, Path `/`, maxAge 900. Página limpa usa `auth()` e `loginHref('/resgatar')`, mostra botão de resgate; nunca renderiza token. POST usa `assertSameOrigin`, `auth` e cookie, calcula hash; `db.transaction`: `UPDATE activation_bonus_offers SET redeemed_at=now WHERE token_hash=hash AND user_id=session.userId AND state='attempted' AND redeemed_at IS NULL RETURNING id`; somente linha vencedora insere em `credit_ledger` (`amount:2,kind:'bonus',description:'activation:'+offer.id`). Se UPDATE não retornar, SELECT por `userId`+`tokenHash` distingue oferta própria já resgatada de token inválido/de outra conta. Conta B não atualiza linha A. Limpar cookie após sucesso; consulta autenticada de oferta por usuário mostra "já resgatado".

```ts
const [winner] = await tx.update(schema.activationBonusOffers)
  .set({ redeemedAt: now })
  .where(and(eq(schema.activationBonusOffers.tokenHash, tokenHash),
    eq(schema.activationBonusOffers.userId, userId),
    eq(schema.activationBonusOffers.state, 'attempted'),
    isNull(schema.activationBonusOffers.redeemedAt)))
  .returning({ id: schema.activationBonusOffers.id });
if (winner) await tx.insert(schema.creditLedger).values({
  userId, amount: 2, kind: 'bonus', description: `activation:${winner.id}`,
});
```

- [ ] **Step 4: Verify.** Vitest + Playwright focados, mock do cookie/Provider e teste local Postgres de dois resgates concorrentes; nunca usar conta real para testar.

### Task 5: Preferência, política e configuração de deploy

**Files:**
- Create: `src/app/api/email-preferences/route.ts`
- Create: `src/app/api/email-preferences/route.test.ts`
- Create: `src/components/activation-email-preference.tsx`
- Modify: `src/app/(app)/perfil/page.tsx`
- Modify: `src/app/(legal)/privacidade/page.tsx`
- Modify: `src/app/(legal)/cookies/page.tsx`
- Modify: `.env.example`
- Modify: `docs/DEPLOY.md`

**Interfaces:** Consome `users.activationBonusOptOutAt`; POST autenticado `{ offersEnabled: boolean }` atualiza campo com `now` ou NULL e é protegido por `assertSameOrigin`; cron Task 3 lê o campo antes de reservar envio.

- [ ] **Step 1: RED rota de preferência.** Sem sessão retorna 401, origem cruzada 403, boolean inválido 400; `{offersEnabled:false}` grava timestamp, `{offersEnabled:true}` limpa coluna; e-mails de boas-vindas/dunning não consultam esse campo.
- [ ] **Step 2: RED.** `npm test -- src/app/api/email-preferences/route.test.ts` — rota ausente.
- [ ] **Step 3: GREEN preferência.** `POST /api/email-preferences` protegido por origem/sessão, `Cache-Control:no-store`; botão em `/perfil` exibe estado atual do usuário e chama rota; nenhuma preferência muda `analyticsConsent`. Adicionar texto de ativação e opt-out às políticas; `.env.example` documenta `ACTIVATION_BONUS_START_AT`, `EMAIL_ENABLED`, `APP_URL`, `CRON_SECRET` sem segredos. `docs/DEPLOY.md` descreve cron Railway separado `0 * * * *` com bearer secret e lotes. Não provisionar cron ou aplicar patch staged existente automaticamente.

```ts
const { offersEnabled } = await request.json();
if (typeof offersEnabled !== 'boolean') return NextResponse.json({ error: 'invalid' }, { status: 400 });
await db.update(schema.users)
  .set({ activationBonusOptOutAt: offersEnabled ? null : new Date() })
  .where(eq(schema.users.id, session.userId));
```

- [ ] **Step 4: Full verification.** `npm test`, `npm run lint`, `npm run build`, `git diff --check`; e2e resgate/opt-out com token e provedor mockados; comparar migração gerada com spec. Revisar backend para não logar query/tokens.

## Publicação

- [ ] Inspecionar `git status`, `git diff`, `git log -10`; commitar apenas quando usuário pedir, excluindo `.opencode/` e `opencode.jsonc`; docs `docs/superpowers/` exigem `git add -f` por ignore global.
- [ ] Deploy primeiro do app e migração. Confirmar `ACTIVATION_BONUS_START_AT` e variáveis antes de criar serviço cron; teste apenas em sandbox/local com envio de e-mail mockado. Railway `accept-deploy` exige autorização explícita e patch `function-bun` pendente não deve ser aplicado junto.
- [ ] Só depois de validação, ativar cron horário e acompanhar contagens sem PII. Rever logs de borda/origem para evitar retenção da URL inicial com token. Falha ambígua de envio não reabre a oferta; resgate de B não consome link de A.
