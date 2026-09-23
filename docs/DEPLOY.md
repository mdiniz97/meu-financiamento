# Deploy — Railway + Neon + Cloudflare + Asaas

Guia de produção do **amortiza.me**: app Next.js 16 (App Router) em container
**Railway**, banco Postgres gerenciado no **Neon**, borda/DNS/WAF no
**Cloudflare** e cobrança/assinaturas no **Asaas**.

> Este documento substitui o guia antigo (Vercel). O `vercel.json` foi
> **removido** — o Railway não lê esse arquivo e manter os dois implicaria que a
> Vercel ainda é o alvo. Os schedules dos crons estão documentados abaixo.

## Arquitetura

| Camada | Tecnologia | Observação |
| ------ | ---------- | ---------- |
| App/API | Next.js 16 (App Router, RSC, Server Actions, `after()`) | Runtime **Node.js**. Nenhuma rota usa `export const runtime = 'edge'`; o `pg` (node-postgres) e o `@react-pdf/renderer` exigem Node. |
| Processo | Docker (`output: 'standalone'`) no Railway | Processo Node **de vida longa** — `db.transaction` e `pg.Pool` funcionam normalmente. |
| Banco | Postgres (Neon) | App usa a conexão **POOLED** (`DATABASE_URL`); migrações usam a **UNPOOLED** (`DATABASE_URL_UNPOOLED`). |
| Auth | NextAuth v5 + JWT | Sessão assinada por `AUTH_SECRET`; login de produção é só Google. |
| Pagamento | Asaas | Provider selecionado por `PAYMENT_PROVIDER=asaas`. |
| Borda | Cloudflare (proxy laranja) | DNS, WAF, CDN. Origem: domínio custom do Railway. |

## O que mudou em relação à Vercel

| Item | Vercel | Railway |
| ---- | ------ | ------- |
| Build | gerenciado pelo framework | `Dockerfile` multi-stage (`output: 'standalone'`) |
| Start | automático | `node server.js` (`railway.json`) |
| Healthcheck | — | `GET /api/health` (novo, sem tocar no banco) |
| Migrações | passo manual | **release step** (`preDeployCommand`, roda antes de trocar o tráfego) |
| Cron | `vercel.json` | **Railway Cron Jobs** (serviços separados) |
| Segredos | `vercel env` | variáveis do serviço no Railway |

## Artefatos de deploy no repositório

| Arquivo | Papel |
| ------- | ----- |
| `Dockerfile` | Imagem Node 22 multi-stage: `deps` → `builder` (`npm ci` + `npm run build`) → `runner` (não-root). Copia `.next/standalone`, `.next/static` e `public/`. |
| `.dockerignore` | Exclui `node_modules`, `.next`, `.env*` (segredos), testes, planilhas etc. |
| `railway.json` | Builder Dockerfile, start `node server.js`, healthcheck `/api/health`, release step de migração, restart policy. |
| `next.config.ts` | `output: 'standalone'` + `serverExternalPackages: ['@react-pdf/renderer']` + headers de segurança. |
| `src/app/api/health/route.ts` | Healthcheck leve (`{ ok: true }`, `no-store`), sem banco. |
| `scripts/migrate.mjs` | Migrador de runtime (`drizzle-orm/node-postgres/migrator`) — não precisa de `drizzle-kit` na imagem final. |
| `drizzle.config.ts` | Prefere `DATABASE_URL_UNPOOLED ?? DATABASE_URL` (dev/CI cai no fallback). |

## Pré-requisitos

- Conta no [Railway](https://railway.app), projeto no [Neon](https://neon.tech) e conta Cloudflare com o domínio `amortiza.me`.
- Conta Asaas (produção) com chave de API e dados do webhook.
- Node.js 22+ e Docker local (para testar a imagem) — opcional.

## Passo 1 — Neon (pooled vs. unpooled)

No console do Neon, aba **Connect**, copie **duas** strings do mesmo banco/role:

- **Pooled** (host com `-pooler`) → `DATABASE_URL`. O app é um processo Node de
  vida longa com `pg.Pool`; o pooler do Neon (PgBouncer) atende bem esse padrão.
- **Unpooled** (host sem `-pooler`) → `DATABASE_URL_UNPOOLED`. Usada **só** por
  migrações (DDL via pooler é problemático).

Ambas já trazem `sslmode=require`. Seed inicial (idempotente, uma vez, apontando
para o Neon):

```bash
DATABASE_URL_UNPOOLED="postgresql://...neon.tech/...?sslmode=require" npm run db:migrate
DATABASE_URL_UNPOOLED="postgresql://...neon.tech/...?sslmode=require" npx tsx src/db/seed.ts
```

> O seed insere os packs `credits10` e `unlimited` (`onConflictDoNothing`).
> **Assinaturas**: confirme a migração `0010_asaas_subscriptions.sql` aplicada
> ANTES de ligar `PAYMENT_PROVIDER=asaas` (cria `webhook_events`,
> `subscriptions.asaas_*` e `payments`).

## Passo 2 — Railway

### 2.1 Serviço

1. **New Project → Deploy from GitHub repo** (branch `main`).
2. O Railway detecta o `railway.json` e usa o **Dockerfile**.
3. Cada push em `main` gera um novo deploy; o release step roda as migrações
   antes do tráfego ser trocado.

### 2.2 Variáveis de ambiente

Defina no serviço (Settings → Variables). Lista completa na seção
[Variáveis](#variáveis-ambiente) abaixo. Mínimo para subir:

```
DATABASE_URL            # pooled (Neon)
DATABASE_URL_UNPOOLED   # unpooled (Neon) — usada pelas migrações
AUTH_SECRET             # openssl rand -base64 32 (estável)
AUTH_URL                # https://amortiza.me
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
PAYMENT_PROVIDER        # asaas
APP_URL                 # https://amortiza.me
CRON_SECRET             # openssl rand -hex 32
ASAAS_ENV               # production
ASAAS_API_KEY
ASAAS_WEBHOOK_AUTH_TOKEN
```

> **`PORT` e `HOSTNAME`**: o Railway injeta `PORT`; o `Dockerfile` já define
> `HOSTNAME=0.0.0.0` e o server standalone escuta em `0.0.0.0:$PORT`. Não
> sobrescreva. **Não defina `NODE_ENV`** (o Dockerfile fixa `production`).

### 2.3 `railway.json`

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "node server.js",
    "preDeployCommand": "node scripts/migrate.mjs",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- **`preDeployCommand`**: roda na mesma imagem, antes do release. Usa
  `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. Se falhar, o deploy **não** promove.
- **Healthcheck** `/api/health`: leve e sem banco (o schema já foi migrado no
  release step), evita falso negativo em cold start do Neon.

### 2.4 Domínio custom

1. Railway → Settings → **Networking → Custom Domain**: adicione `amortiza.me`
   (e, se quiser, `www`).
2. O Railway emite um certificado de origem; anote o **CNAME/TXT** de validação.
3. Configure no Cloudflare (Passo 3) e só então valide o domínio no Railway.

## Passo 3 — Cloudflare (DNS/WAF/CDN)

Nenhuma mudança é feita por este repositório; os passos abaixo são de painel.

### 3.1 DNS

- Registro `CNAME` de `@`/`amortiza.me` para o alvo do Railway, **Proxy status =
  Proxied** (nuvem laranja). Idem para `www` se existir.

### 3.2 SSL/TLS — modo **Full** (end-to-end)

- Cloudflare → SSL/TLS → Overview: **Full**. O Railway **exige `Full`** (e não
  `Full (Strict)`) quando o proxy Cloudflare está ligado — a doc do Railway é
  explícita: com proxy, *"Full (Strict) will not work as intended"*.
- Habilite **Always Use HTTPS** e **Automatic HTTPS Rewrites**.
- **Não** use "Flexible" (quebraria cookies `Secure` e o HSTS do app).
- O app já envia HSTS (`max-age=63072000; includeSubDomains; preload`). Só envie
  para preload no Cloudflare **se** tiver certeza de que todos os subdomínios
  são HTTPS.

### 3.3 WAF — restringir `/api/asaas/webhook` aos IPs do Asaas

Crie uma regra (Security → WAF → Custom rules):

- **Expressão**: `(http.request.uri.path eq "/api/asaas/webhook" and not ip.src in {52.67.12.206 18.230.8.159 54.94.136.112 54.94.183.101})`
- **Ação**: `Block`.

Isso é o **espelho na borda** da allowlist opcional do app
(`ASAAS_WEBHOOK_IP_ALLOWLIST`, mesmo CSV). Se a regra WAF estiver ativa, a env do
app pode ficar **vazia** (defense-in-depth em um lugar só); se preferir cinto e
suspensório, configure as duas.

> **Importante (origem acessível):** o domínio padrão `*.up.railway.app`
> continua público e **não** passa pelo Cloudflare. Um atacante que descubra esse
> host pode chamar `/api/asaas/webhook` direto e forjar `x-forwarded-for`. Para
> tornar a allowlist por IP confiável, **restrinja o acesso à origem** (ex.:
> desabilitar o domínio público do Railway, usar um domínio só exposto via
> Cloudflare, ou aceitar que o `asaas-access-token` é a defesa primária).
> Enquanto isso, a regra WAF continua válida para o tráfego via `amortiza.me`.

### 3.4 Cache e cabeçalhos

Crie uma **Cache Rule** (Caching → Cache Rules) para `amortiza.me/api/*` com
**Bypass cache**. Motivos:

- As rotas `/api/*` são dinâmicas e sensíveis a sessão; cachear vaza dados entre
  usuários.
- O webhook do Asaas e os crons **não podem** ser cacheados.
- `Set-Cookie` deve passar **intacto** (o app usa cookies de sessão do
  NextAuth). **Não** habilite "Cache Everything" em `/api/*` nem transformações
  que removam cookies.

O Next já marca páginas dinâmicas com `Cache-Control: private, no-cache,
no-store`; o Cloudflare respeita isso quando não há cache forçado. Assets
imutáveis (`/_next/static/*`, `/_next/image`) já vêm com `immutable` e são
seguros de cachear.

### 3.5 Proxy, IP do cliente e streaming

- O app lê o cliente em `x-forwarded-for` (primeiro valor) e `x-real-ip`. O
  Cloudflare sobrescreve `x-forwarded-for` com o IP real, então a allowlist do
  Asaas funciona **atrás** do proxy. **Não** confie nesse header se a origem for
  alcançável diretamente (ver 3.3).
- App Router usa streaming: mantenha o Cloudflare sem buffering agressivo.
  O Cloudflare não faz buffering que quebre streaming por padrão; se adicionar
  regras, evite transformações na resposta HTML.

## Passo 4 — Asaas

### 4.1 Registrar o webhook (uma vez por ambiente)

Com `ASAAS_ENV=production`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_AUTH_TOKEN`,
`APP_URL=https://amortiza.me` e `WEBHOOK_ADMIN_EMAIL` no ambiente local:

```bash
npx tsx scripts/register-asaas-webhook.ts
# → webhook criado: wh_...   (ou "webhook atualizado: wh_..." se já existia)
```

O script é idempotente: consulta `GET /v3/webhooks`, casa pela `url`
`${APP_URL}/api/asaas/webhook` e faz `PUT` no existente ou `POST` se não houver.
Valide com `GET /v3/webhooks` (`enabled: true`, `interrupted: false`).

### 4.2 Auditoria de segurança/comportamento (código)

| Tema | Como está no código | Arquivo |
| ---- | ------------------- | ------- |
| Autenticação do webhook | Header `asaas-access-token` comparado em **tempo constante** (`timingSafeEqual`, tamanho igual). Sem token/segredo → nega. | `src/lib/payments/asaas/webhook.ts` |
| Allowlist de IP (opcional) | `ASAAS_WEBHOOK_IP_ALLOWLIST` vazia = não bloqueia; preenchida = 403 antes de validar o token, usando o 1º IP de `x-forwarded-for`/`x-real-ip`. | `src/app/api/asaas/webhook/route.ts` |
| Idempotência | `webhook_events.asaas_event_id` é **UNIQUE**; `insert ... onConflictDoNothing` descarta reentrega. Só processa se a linha foi criada. | `webhook_events` (schema) |
| Processamento assíncrono | `after(() => processWebhookEvent(rowId))` — responde 200 rápido e processa em background (suportado no self-host com `next start`/standalone). | `src/app/api/asaas/webhook/route.ts` |
| Retries/reprocessamento | Eventos com `processed_at IS NULL` são reprocessados pelo cron de **reconcile** (falha do `after()`/queda do processo). `attempts` e `last_error` ficam gravados. | `src/lib/subscriptions/reconcile.ts`, `processWebhookEvent` |
| Persistência de eventos | `webhook_events` guarda payload **sanitizado** (remove CVV/CVC/token e `customerData`; cartão mascarado nos 4 últimos). | `src/lib/subscriptions/apply-event.ts` |
| Assinatura | `CHECKOUT_*`/`SUBSCRIPTION_*`/`PAYMENT_*` correlacionam por `providerId → asaasCheckoutId → externalReference`; renovação **estende** o período, nunca encolhe; acesso só em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`. | `applyAsaasEvent` |
| Créditos avulsos | `DETACHED` libera crédito com descrição estável `Compra créditos (providerId pay_)` sob índice único parcial — replay não duplica. | `applyCreditPurchase` |
| NFS-e | **Gated** por `ASAAS_INVOICE_ENABLED=true`; configura só com `ASAAS_ENV=production`; upsert de `INVOICE_*` por `asaas_invoice_id`. | `applyInvoiceEvent`, `configureInvoiceIfEnabled` |
| NFS-e de créditos | Com a flag ligada, `PAYMENT_CONFIRMED`/`RECEIVED` de compra avulsa agenda `POST /v3/invoices` (consulta por `payment` antes — sem `Idempotency-Key`). Falha de nota nunca bloqueia o crédito. | `scheduleCreditInvoiceIfEnabled`, `scheduleInvoiceOnce` |

> NFS-e é **inertes até existir serviço municipal configurado**: com a flag
> ligada mas sem `ASAAS_INVOICE_MUNICIPAL_SERVICE_ID`/`_CODE`, nada é emitido —
> só um aviso no log. Não é validável em sandbox nesta conta (exige certificado
> A1). A prefeitura de Brasília **não permite cancelar NFS-e pela API**, então
> confirme serviço, ISS e NBS com o contador antes de configurar o serviço.
> Ver `.env.example`.

## Crons no Railway

Os jobs do extinto `vercel.json` vivem como **Railway Cron Jobs**. Os endpoints
já são autenticados por `Authorization: Bearer $CRON_SECRET`
(`src/lib/cron-auth.ts`) e aceitam `GET` ou `POST`. Um cron do Railway roda o
**start command** do serviço no horário e o processo precisa **terminar** —
caso contrário o Railway pula a execução seguinte.

| Job | Endpoint | Schedule (UTC) |
| --- | -------- | -------------- |
| Reconciliação de assinaturas + reprocesso de webhooks | `POST /api/cron/reconcile` | `0 6 * * *` |
| Dunning (inadimplência/carência) | `POST /api/cron/dunning` | `0 7 * * *` |
| Reajuste do ISS das assinaturas (NFS-e) | `POST /api/cron/invoice-settings` | `0 8 1 * *` (mensal) |

Receita verificada em produção: **imagem `alpine:3.20`** + start command
abaixo, `APP_URL` e `CRON_SECRET` referenciando o serviço web
(`${{amortiza-web.APP_URL}}`, `${{amortiza-web.CRON_SECRET}}`) e o
**Cron Schedule** da tabela.

```bash
sh -c 'echo "[cron-reconcile] start"; wget -S -O - --header="Authorization: Bearer $CRON_SECRET" --post-data="" "$APP_URL/api/cron/reconcile" 2>&1; code=$?; echo; echo "[cron-reconcile] exit=$code"'
# e, nos outros serviços, troque o endpoint no fim:
#   ... "$APP_URL/api/cron/dunning"        → "[cron-dunning]"
#   ... "$APP_URL/api/cron/invoice-settings" → "[cron-invoice-settings]"
```

O `echo`/`-S` não são decorativos: sem eles um `401` (segredo trocado) falha
**em silêncio** e o cron parece saudável. Confira o `[cron-...] exit=0` e o
`HTTP/1.1 200 OK` nos logs.

> ⚠️ **Não use `curlimages/curl`.** O entrypoint dessa imagem **é o próprio
> `curl`**, então `sh -c '...'` é interpretado como argumentos e o resultado é
> uma tempestade de `curl: try 'curl --help'`. Já quebrou em produção. O
> `alpine` traz `wget` (busybox) embutido — sem `apk add` (que também falha:
> sem rede no start, resulta em `sh: curl: not found`).

> O cron de NFS-e existe porque o ISS varia com o faturamento e o
> `invoiceSettings` de uma assinatura é aplicado **uma única vez** — sem
> reenvio, as cobranças seguintes mantêm a alíquota da contratação. Compras
> avulsas não precisam dele: o `taxes` vai em cada `POST /v3/invoices`.

> ⚠️ **Não verificado neste repo**: o `railway.json` (config-as-code) **não**
> expressa cron schedules; a configuração é feita no painel/CLI do Railway.
> Confirme o fuso (o schedule do Railway é em **UTC**) e o formato na
> documentação atual do Railway antes de confiar nos horários.

## Deploy

1. Push em `main` (ou deploy manual pelo Railway).
2. Railway faz o build da imagem (`npm ci` → `npm run build` → runner standalone).
3. **Release step**: `node scripts/migrate.mjs` aplica migrações pendentes
   (`drizzle/`) usando `DATABASE_URL_UNPOOLED`.
4. Sobe o container (`node server.js`) e só recebe tráfego após `/api/health`
   responder 200.

Build/run local da imagem (paridade com o Railway):

```bash
docker build -t amortiza-me .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://...pooler.../db?sslmode=require" \
  -e DATABASE_URL_UNPOOLED="postgresql://.../db?sslmode=require" \
  -e AUTH_SECRET=dev -e AUTH_URL=http://localhost:3000 \
  -e PAYMENT_PROVIDER=fake \
  amortiza-me
curl -s localhost:3000/api/health
```

> Em `docker run --env-file .env.local`, o escape `\$` da `ASAAS_API_KEY` (usado
> pelo dotenv do Next) chega **literal** ao container. Para testar Asaas na
> imagem, passe `ASAAS_API_KEY` sem o `\` (`-e ASAAS_API_KEY='$aact_...'`).

## Migrações

- **Release step** (automático): `node scripts/migrate.mjs`. Usa
  `DATABASE_URL_UNPOOLED ?? DATABASE_URL` e roda antes do tráfego.
- **Manual / offline**:

```bash
npx drizzle-kit generate          # gera SQL a partir de src/db/schema.ts
DATABASE_URL_UNPOOLED="<neon-unpooled>" npm run db:migrate
```

- Migrações são **forward-only** (sem down). Um rollback de código deve ser
  compatível com o schema já aplicado.

## Rollback

1. Railway → serviço → **Deployments** → selecione o deploy anterior →
   **Redeploy** (volta a imagem/commit anterior).
2. Como as migrações já foram aplicadas e são **forward-only**, garanta que o
   código antigo tolera o schema novo (migrações devem ser aditivas). Se a
   migração for destrutiva, o rollback de código exige um passo manual de banco
   (fora do escopo deste guia).
3. O release step do deploy antigo tentará rodar migrações — como o journal já
   está aplicado, é no-op.

## Observabilidade

- **Railway**: logs do deploy e do runtime (stdout/stderr), métricas de CPU/RAM,
  histórico de deploys e healthchecks.
- **Healthcheck**: `GET /api/health` (200 = processo vivo). Não mede banco de
  propósito.
- **Neon**: console com queries/consumo; monitore conexões do `pg.Pool`.
- **Asaas**: `GET /v3/webhooks` mostra `enabled`/`interrupted`. 15 falhas pausam
  a fila e eventos com +14 dias somem — o cron `reconcile` cobre lacunas de
  processamento local, não a fila do Asaas.
- **Webhooks**: tabela `webhook_events` (`processed_at`, `attempts`,
  `last_error`) é a fonte para investigar eventos não processados.

## Variáveis de ambiente

| Variável | Valor / origem | Detalhe |
| -------- | -------------- | ------- |
| `DATABASE_URL` | Neon **pooled** | Runtime do app. |
| `DATABASE_URL_UNPOOLED` | Neon **unpooled** | Migrações (release step e `drizzle.config.ts`). Fallback para `DATABASE_URL`. |
| `AUTH_SECRET` | `openssl rand -base64 32` | **Estável** entre deploys — mudar invalida sessões. |
| `AUTH_TRUST_HOST` | `true` | **Obrigatório** atrás do proxy (Cloudflare+Railway): confia no `X-Forwarded-Host`. Sem isso o login quebra. |
| `AUTH_URL` | `https://amortiza.me` (opcional) | Canônico; no v5 o host já é inferido dos headers. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console | Callback: `https://amortiza.me/api/auth/callback/google`. |
| `PAYMENT_PROVIDER` | `asaas` | `fake` é bloqueado com `NODE_ENV=production`. |
| `ASAAS_ENV` | `production` \| `sandbox` | Escolhe a base URL default. |
| `ASAAS_BASE_URL` | `https://api.asaas.com/v3` | Produção (sandbox: `...api-sandbox.asaas.com/v3`). |
| `ASAAS_API_KEY` | `$aact_prod_...` | Ver pegadinha do `$` abaixo. |
| `ASAAS_WEBHOOK_AUTH_TOKEN` | `openssl rand -base64 48` | `authToken` do webhook (header `asaas-access-token`), mín. 32 chars. |
| `ASAAS_WEBHOOK_IP_ALLOWLIST` | CSV de IPs (opcional) | Vazio = não bloqueia; produção = os 4 IPs oficiais. Não use em sandbox. |
| `APP_URL` | `https://amortiza.me` | Base do webhook/callbacks (`${APP_URL}/api/asaas/webhook`). Sem barra final. |
| `CRON_SECRET` | `openssl rand -hex 32` | Protege `/api/cron/*` via `Authorization: Bearer`. |
| `WEBHOOK_ADMIN_EMAIL` | email | Alertas do webhook no Asaas (só o script de registro lê). |
| `ASAAS_INVOICE_ENABLED` | `false` (default) | NFS-e; só `true` exato habilita. |
| `ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME` | nome | Obrigatório com a flag ligada. |
| `ASAAS_INVOICE_MUNICIPAL_SERVICE_ID` | id | Municípios que listam serviços (ex.: Brasília, `id 290420`). Precede o código. |
| `ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE` | código | Use quando o município não lista serviços. |
| `ASAAS_INVOICE_EFFECTIVE_PERIOD` | `ON_PAYMENT_CONFIRMATION` (default) | Entre outros valores válidos do Asaas. |
| `ASAAS_INVOICE_RETAIN_ISS`, `_ISS`, `_PIS`, `_COFINS`, `_CSLL`, `_INSS`, `_IR` | `true/false` e % | Opcionais. |
| `ASAAS_INVOICE_NBS_CODE` / `_TAX_SITUATION_CODE` / `_TAX_CLASSIFICATION_CODE` / `_OPERATION_INDICATOR_CODE` / `_OBSERVATIONS` | opcionais | Omitidos se vazios. |
| `NODE_ENV` | **não definir** | O Dockerfile fixa `production`. |

### Pegadinha do `$` na `ASAAS_API_KEY`

A chave começa com `$` (`$aact_prod_...`), que o shell e o `@next/env` /
dotenv-expand expandem. Em arquivos `.env*`, escape com `\` **no valor**:

```bash
# .env.local (lido com dotenv-expand → precisa do \)
ASAAS_API_KEY=\$aact_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

No **Railway** (e em `docker run -e`) o valor é injetado direto, **sem**
dotenv-expand: grave a chave **crua** (use aspas simples no shell para o próprio
shell não expandir).

## Checklist de produção

- [ ] Neon: `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` definidas no Railway.
- [ ] Migrações aplicadas (`0010` em diante) — confira o release step verde.
- [ ] `AUTH_SECRET` estável; **`AUTH_TRUST_HOST=true`**; `AUTH_URL=https://amortiza.me` (opcional).
- [ ] Google OAuth com callback `https://amortiza.me/api/auth/callback/google`.
- [ ] `PAYMENT_PROVIDER=asaas`; `ASAAS_ENV=production`; chave de produção (sem `\`).
- [ ] `APP_URL=https://amortiza.me` (sem barra final) e webhook registrado
      (`GET /v3/webhooks` com `enabled: true`, `interrupted: false`).
- [ ] `ASAAS_WEBHOOK_IP_ALLOWLIST` com os 4 IPs **ou** regra WAF no Cloudflare
      (decida uma; cinto e suspensório é válido).
- [ ] `CRON_SECRET` forte e os dois Railway Cron Jobs criados (UTC).
- [ ] Cloudflare: proxy laranja, SSL **Full** (não `Full (Strict)`), bypass de cache em `/api/*`.
- [ ] Healthcheck `/api/health` verde e domínio custom validado no Railway.
- [ ] Fluxos: cadastro/login Google, simulação, PDF (Ilimitado), comparador,
      checkout de créditos, assinatura (sandbox → produção), webhook e crons.
- [ ] Origem pública do Railway restringida (ou risco de bypass do WAF aceito).

## Não verificado neste ambiente

- **Cron no Railway**: formato local (painel/CLI), fuso UTC e limites — confirmar
  na documentação atual; `railway.json` não expressa schedules aqui.
- **SSL `Full`** com o certificado de origem do Railway e a ordem DNS/Railway —
  a doc do Railway exige `Full` (não `Strict`) com proxy Cloudflare; confirmar
  no painel.
- **`AUTH_TRUST_HOST=true`**: é o requisito documentado pelo Auth.js v5 atrás de
  proxy (`X-Forwarded-Host`). O código **não** seta `trustHost` de propósito.
  Ainda assim, validar em staging: `GET /api/auth/providers` com
  `X-Forwarded-Host: amortiza.me` deve responder 200 (e nenhum redirect para
  `*.up.railway.app`).
- **PDF em produção**: validado que `@react-pdf/renderer` carrega na imagem
  Docker (build `npm ci`); o fluxo autenticado de download não foi exercitado.
