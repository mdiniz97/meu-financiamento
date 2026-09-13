# Deploy — Vercel + Neon

Guia passo a passo para publicar o **amortiza.me** em produção (Vercel)
com banco Postgres gerenciado (Neon).

## Arquitetura

| Camada  | Tecnologia | Observação |
| ------- | ---------- | ---------- |
| Front/API | Next.js 16 (App Router) | Runtime **Node.js** (padrão) — nenhuma rota usa `export const runtime = 'edge'`, e o `pg` (node-postgres) é compatível. **Não usar edge runtime.** |
| Banco | Postgres (Neon) | Acesso via `drizzle-orm/node-postgres` (`src/db/index.ts`). Porta padrão **5432**. |
| Auth | NextAuth v5 + JWT | Assinado por `AUTH_SECRET`. |
| Pagamento | Provider via env `PAYMENT_PROVIDER` | `fake` (só dev), `stripe` ou `asaas` (ver aviso abaixo). |

`next.config.ts` já declara `serverExternalPackages: ['@react-pdf/renderer']`
(necessário para o export de PDF — funciona no runtime Node da Vercel, sem
configuração extra).

## Portas e URLs de conexão

| Ambiente | URL | Porta |
| -------- | --- | ----- |
| Local (docker-compose) | `postgres://postgres:postgres@localhost:5433/financiamento` | **5433** (mapeada para 5432 do container) |
| CI (GitHub Actions) | service container | **5432** |
| Neon / Vercel | `postgresql://<user>:<pass>@ep-*.neon.tech/<db>?sslmode=require` | **5432** |

> A porta local (5433) é **só para dev**. Nunca use a string local em deploy.

## Pré-requisitos

- Node.js 20+
- Conta em [neon.tech](https://neon.tech) e [vercel.com](https://vercel.com)
- CLI do Vercel: `npm i -g vercel`

## Passo 1 — Criar projeto Neon e buscar a connection string

1. Em https://console.neon.tech → **New Project** (nome sugerido: `meu-financiamento`, região próxima aos usuários, ex. `São Paulo (sa-east-1)`).
2. Na aba **Connect**, copie a connection string do Postgres (formato `postgresql://...neon.tech/...?sslmode=require`).
   - A string padrão do Neon já traz `sslmode=require`, suportado pelo driver `pg`. Se ocorrer erro de SSL, adicione `?sslmode=require` ao final da URL.

## Passo 2 — Migrar e popular o banco (localmente, apontando para o Neon)

Na raiz do projeto, rodar migrações e seed **com a URL do Neon** (não a local):

```bash
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npm run db:migrate
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npx tsx src/db/seed.ts
```

- `db:migrate` = `drizzle-kit migrate` (aplica as migrações em `drizzle/`).
- `seed.ts` insere os packs `credits10` (10 créditos) e `unlimited` (assinatura) — idempotente (`onConflictDoNothing`).
- Verifique no console do Neon: tabelas criadas + tabela `packs` com 2 linhas.

> Migrações **não** rodam automaticamente no deploy. Em toda mudança de schema,
> repita este passo (ou `vercel run npm run db:migrate`, que usa as variáveis do projeto).

> **Assinaturas (Asaas): rode a migração `0010_asaas_subscriptions.sql` ANTES do
> deploy** que liga as assinaturas (`ASAAS_*` + `PAYMENT_PROVIDER=asaas`). Ela cria
> `webhook_events`, `subscriptions.asaas_*` e `payments`. Deploy sem ela → o
> endpoint do webhook e o cron de dunning quebram ao consultar as tabelas.

## Passo 3 — Conectar a Vercel e configurar variáveis de ambiente

```bash
vercel login
vercel link          # escolha o projeto (ou crie novo) e o scope
```

Adicionar as variáveis para os ambientes **preview** e **production**:

```bash
vercel env add DATABASE_URL preview     # connection string do Neon (idem para production)
vercel env add AUTH_SECRET preview      # mesmo valor nos dois ambientes
vercel env add AUTH_GOOGLE_ID preview       # id do OAuth Google (idem para production)
vercel env add AUTH_GOOGLE_SECRET preview   # secret do OAuth Google (idem para production)
vercel env add PAYMENT_PROVIDER preview # fake
vercel env add PAYMENT_PROVIDER production  # fake (ver AVISO) — trocar por stripe|asaas antes do lançamento

# Asaas (assinaturas) — só necessárias quando PAYMENT_PROVIDER=asaas
vercel env add ASAAS_ENV production              # sandbox | production
vercel env add ASAAS_BASE_URL production         # https://api.asaas.com/v3 (prod) ou ...sandbox...
vercel env add ASAAS_API_KEY production          # chave do ambiente (ver pegadinha do $ abaixo)
vercel env add ASAAS_WEBHOOK_AUTH_TOKEN production  # token do header asaas-access-token, mín. 32 chars
vercel env add APP_URL production                # https://amortiza.me (base do webhook/callbacks)
vercel env add CRON_SECRET production            # openssl rand -hex 32 (protege /api/cron/dunning)
```

| Variável | Valor | Detalhe |
| -------- | ----- | ------- |
| `DATABASE_URL` | connection string do Neon | mesma para preview e production |
| `AUTH_SECRET` | `openssl rand -base64 32` | **mesmo valor nos dois ambientes** — se mudar, todas as sessões são invalidadas |
| `AUTH_GOOGLE_ID` | id do OAuth Google | credenciais em console.cloud.google.com |
| `AUTH_GOOGLE_SECRET` | secret do OAuth Google | mesmo valor nos dois ambientes |
| `PAYMENT_PROVIDER` | `fake` | dev/preview; em produção ver AVISO abaixo |
| `ASAAS_ENV` | `sandbox` \| `production` | escolhe a base URL default; sem `ASAAS_BASE_URL` usa a do ambiente |
| `ASAAS_BASE_URL` | `https://api.asaas.com/v3` | produção; sandbox = `https://api-sandbox.asaas.com/v3` |
| `ASAAS_API_KEY` | `$aact_prod_...` | **pegadinha do `$`** (abaixo); nunca versionar |
| `ASAAS_WEBHOOK_AUTH_TOKEN` | `openssl rand -base64 48` | mínimo 32 chars; é o `authToken` do webhook, **não** a API key |
| `APP_URL` | `https://amortiza.me` | base de `${APP_URL}/api/asaas/webhook` e das callbacks do checkout |
| `CRON_SECRET` | `openssl rand -hex 32` | protege `/api/cron/dunning` |

### Pegadinha do `$` na `ASAAS_API_KEY`

A chave sandbox (`$aact_hmlg_...`) e a de produção (`$aact_prod_...`) começam com
`$`, que o shell **e** o `@next/env`/dotenv-expand interpretam como expansão de
variável. Aspas simples/duplas **não** resolvem (o dotenv-expand remove as aspas
e depois expande). Sem escapismo a variável chega VAZIA e a API responde `401` —
mesmo com a chave visível no arquivo. A única forma que sobrevive é escapar com
`\` **no valor**:

```bash
# .env / .env.local (lido por @next/env/dotenv-expand → precisa do \)
ASAAS_API_KEY=\$aact_hmlg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Vercel: a plataforma injeta process.env direto, SEM dotenv-expand — grave o
# valor REAL (sem `\`). Só impeça o shell local de expandir usando aspas simples:
vercel env add ASAAS_API_KEY production <<< '$aact_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

Resumo: `\$` **apenas** dentro de arquivos `.env`/`.env.local`; na Vercel, chave crua.

Não defina `NODE_ENV` — a Vercel e o Next.js gerenciam (`production` em todo
deploy, inclusive preview). O `PAYMENT_PROVIDER=fake` + `NODE_ENV=production`
faz o guard do `getPaymentProvider` lançar erro — ver AVISO.

**Login em produção é somente Google** (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`):
o cadastro por email/senha fica desativado (rota `/cadastro` redireciona para
`/login` e a API `/api/signup` responde 403). Cada conta Google cria um
usuário local com bônus único de 2 créditos — reentrar com a mesma conta
Google reutiliza o usuário, impedindo farming de créditos. Em desenvolvimento
o email/senha continua ativo para facilitar testes. No console do Google,
adicione as callback URLs `https://<projeto>.vercel.app/api/auth/callback/google`
(preview) e `https://<dominio>/api/auth/callback/google` (produção).

## Passo 4 — Deploy

```bash
vercel             # deploy de preview (URL *.vercel.app)
vercel --prod      # deploy de produção
```

Ou conecte o repositório no painel da Vercel (GitHub) para deploy automático:
push em `main` → produção, PR → preview.

## Registrar o webhook do Asaas (produção)

Depois do deploy com `PAYMENT_PROVIDER=asaas` e `APP_URL` corretos, registre o
webhook uma única vez por ambiente. O script usa `getAsaasConfig()` + `POST /v3/webhooks`
(DTO em `references/06-webhooks.md §2.1`) e só inclui os eventos da spec §7.2.

```bash
# com ASAAS_ENV=production/ASAAS_API_KEY/ASAAS_WEBHOOK_AUTH_TOKEN/APP_URL no .env.local
npx tsx scripts/register-asaas-webhook.ts
# → webhook criado: wh_...
```

- `url` = `${APP_URL}/api/asaas/webhook`; `authToken` = `ASAAS_WEBHOOK_AUTH_TOKEN`
  (o token **não** volta em consultas posteriores — guarde-o).
- Sandbox e produção são independentes: rode o script apontando para cada ambiente.
- O `email` configurado recebe os alertas de penalização/fila pausada (15 falhas
  pausam a fila e eventos com +14 dias somem). Monitore `GET /v3/webhooks`.

## Créditos avulsos

Compra de créditos fora do plano Ilimitado, via **Asaas Checkout `DETACHED`**
(cartão **e** Pix). Não exige env nova — usa as mesmas chaves `ASAAS_*` e o
`APP_URL` já configurados para as assinaturas.

- **Checkout**: `POST /api/checkout` com `PAYMENT_PROVIDER=asaas` e um pack
  **não-assinatura** (`isSubscription=false`) insere uma linha `pending` em
  `credit_purchases` (migração `0011`) e chama `POST /v3/checkouts` com
  `billingTypes: ['CREDIT_CARD','PIX']`, `chargeTypes: ['DETACHED']` e
  `externalReference` = id local da compra (uuid). A resposta devolve
  `{ checkoutUrl }` e o botão redireciona para a tela do Asaas.
- **Liberação**: os créditos entram quando o pagamento confirma —
  **cartão → `PAYMENT_CONFIRMED`**, **Pix → `PAYMENT_RECEIVED`** — no mesmo
  webhook `/api/asaas/webhook` (ramo acionado quando nenhuma assinatura resolve).
- **Idempotência por `pay_`**: o lançamento usa a descrição estável
  `Compra créditos (providerId <pay_>)` sob o índice único parcial
  `(user_id, kind='purchase', description)`; reentrega do mesmo pagamento não
  credita de novo. A compra é `paid` também em curto-circuito, então o replay é
  seguro mesmo se o índice for contornado.
- **Nunca expiram**: créditos avulsos são saldo permanente (`credit_ledger`,
  `kind='purchase'`). Assinantes Ilimitado também podem comprar — é saldo à parte.
- `CHECKOUT_EXPIRED`/`CHECKOUT_CANCELED` marcam a compra como `expired`/`canceled`
  e **não** liberam crédito. `PAYMENT_CREATED` é registrado sem liberar.
- Pack de assinatura em `/api/checkout` responde `400` apontando `/assinar`.
- O fluxo `PAYMENT_PROVIDER=fake` permanece intacto.

Nada a configurar na Vercel além do que as assinaturas já exigem. Confirme que a
migração `0011` está aplicada antes do deploy (ver Passo 2).

## NFS-e (opcional)

Emissão automática de **NFS-e por assinatura**, **desligada por padrão**. NÃO é
necessária para vender; habilite só quando a contabilidade estiver pronta.

- **Gate**: `isInvoiceEnabled()` é `true` apenas com
  `ASAAS_INVOICE_ENABLED=true`. Com `false` (default) **nada** roda: nenhum
  `GET /v3/fiscalInfo/`, nenhum `POST /v3/subscriptions/{id}/invoiceSettings`,
  nenhum upsert de evento `INVOICE_*`.
- **Pré-requisito fiscal** (sem isso a feature fica inerte): a conta Asaas precisa
  de `fiscalInfo` configurado — `GET /v3/fiscalInfo/` respondendo **200**
  (404 = conta sem configuração fiscal). É preciso também que a prefeitura aceite
  a emissão da credencial.
- **Credencial municipal**: nesta conta o município retornou
  `authenticationType=CERTIFICATE`, ou seja, exige **certificado digital A1**
  (arquivo `.pfx` + senha) cadastrado no Asaas. Por isso **não é validável em
  sandbox nesta conta** — a ativação fica para quando houver certificado A1 e o
  bloco de impostos preenchido pelo contador.
- **Comportamento quando ligada**: em `SUBSCRIPTION_CREATED` (após gravar o
  `asaas_subscription_id`), o servidor consulta `GET /v3/fiscalInfo/`; se `ok`,
  faz `POST /v3/subscriptions/{id}/invoiceSettings` com
  `{ effectiveDatePeriod, municipalServiceCode, municipalServiceName, taxes: { retainIss, iss, pis, cofins, csll, inss, ir } }`
  e grava `subscriptions.invoice_configured_at`. Sem `fiscalInfo` (404) ou se a
  configuração falhar, apenas loga um aviso — o wrapper é `try/catch` e **nunca**
  derruba o webhook da assinatura.
- **Eventos de nota**: `INVOICE_CREATED|INVOICE_UPDATED|INVOICE_SYNCHRONIZED|INVOICE_AUTHORIZED|INVOICE_PROCESSING_CANCELLATION|INVOICE_CANCELED|INVOICE_CANCELLATION_DENIED|INVOICE_ERROR`
  fazem upsert em `invoices` (por `asaas_invoice_id`); só são processados com a
  flag ligada. Painel/download da nota para o cliente **não** entra no MVP.

Variáveis (bloco comentado no `.env.example`; nunca versionar valores reais):

| Variável | Valor | Detalhe |
| -------- | ----- | ------- |
| `ASAAS_INVOICE_ENABLED` | `false` (default) \| `true` | único gatilho; só `true` exato habilita |
| `ASAAS_INVOICE_MUNICIPAL_SERVICE_CODE` | código do serviço | **obrigatório** com a flag ligada (falha no uso) |
| `ASAAS_INVOICE_MUNICIPAL_SERVICE_NAME` | nome do serviço | |
| `ASAAS_INVOICE_EFFECTIVE_PERIOD` | `ON_PAYMENT_CONFIRMATION` (default) \| `ON_PAYMENT_DUE_DATE` \| `BEFORE_PAYMENT_DUE_DATE` \| `ON_DUE_DATE_MONTH` \| `ON_NEXT_MONTH` | valor inválido lança erro |
| `ASAAS_INVOICE_RETAIN_ISS` | `true` \| `false` | |
| `ASAAS_INVOICE_ISS` / `PIS` / `COFINS` / `CSLL` / `INSS` / `IR` | número (%) | vazio = `0` |
| `ASAAS_INVOICE_NBS_CODE` / `TAX_SITUATION_CODE` / `TAX_CLASSIFICATION_CODE` / `OPERATION_INDICATOR_CODE` / `OBSERVATIONS` | opcionais | omitidos do body quando vazios |

## Homologação Asaas (sandbox)

> Execução de **2026-09-13** no worktree `asaas-assinaturas`, apenas chamadas de
> API contra `https://api-sandbox.asaas.com/v3`. Nenhum cartão foi usado, nenhum
> pagamento/checkout foi concluído, nenhum customer foi criado e nenhum webhook
> foi registrado (localhost não é alcançável pelo Asaas).

### Validado automaticamente (API)

| Verificação | Resultado |
| ----------- | --------- |
| Carregamento de `.env.local` via `@next/env` | `ASAAS_API_KEY` chegou preenchida (166 chars, prefixo `$aact_`) — o escape `\$` no arquivo sobreviveu ao `dotenv-expand`. |
| `GET /v3/myAccount/status` | `commercialInfo`, `bankAccountInfo`, `documentation` e `general` = `APPROVED`. |
| `createSubscriptionCheckout` (Task 7) com callbacks `https://` | Aceito. `POST /v3/checkouts` retornou `id` + `link` de sessão de checkout (`https://sandbox.asaas.com/checkoutSession/show/<id>`). O DTO enviado (`billingTypes: ['CREDIT_CARD']`, `chargeTypes: ['RECURRENT']`, `items`, `subscription: {cycle, nextDueDate}`, `externalReference`, `callback`) foi aceito. |
| `GET /v3/subscriptions` | `{"totalCount":0,"hasMore":false,"data":[]}`. |

Script usado (descartável, fora do git em `.superpowers/`):

```bash
npx tsx .superpowers/sdd/2026-09-13-assinaturas-asaas/smoke-checkout.ts
```

**Achado (não é defeito do DTO):** com callbacks `http://localhost:3012/...` o
`POST /v3/checkouts` responde `400 invalid_object` para `successUrl`, `cancelUrl`
e `expiredUrl`. O mesmo corpo com callbacks `https://amortiza.me/...` é aceito —
logo o DTO da Task 7 está correto; o Asaas apenas exige callbacks **https
públicas**. Em dev local, para concluir um checkout no sandbox é preciso expor a
app por túnel (`APP_URL` https) ou usar URLs https de teste. Nenhuma alteração de
código foi feita; decisão fica com o controller.

### Pendente de validação manual (não executado)

Não marcar como validado o que segue — exige app rodando, navegador, URL pública
de webhook e cartão de teste no sandbox:

- [ ] Assinar com cartão aprovado no sandbox e confirmar a ordem dos eventos
      (`CHECKOUT_PAID` / `SUBSCRIPTION_CREATED` / `PAYMENT_CREATED` /
      `PAYMENT_CONFIRMED`) e que o acesso só libera em `PAYMENT_CONFIRMED`.
- [ ] Idempotência: reenviar o mesmo webhook → sem duplicar pagamento nem
      estender o período duas vezes.
- [ ] Inadimplência: `POST /v3/sandbox/payment/{id}/overdue` → `past_due` +
      carência; rodar `runDunning` e conferir avisos/suspensão.
- [ ] Cancelamento: acesso mantido até `currentPeriodEnd`, sem nova cobrança.
- [ ] Registrar webhook sandbox (`npx tsx scripts/register-asaas-webhook.ts`) —
      omitido aqui porque `localhost` não é roteável pelo Asaas.
- [ ] Lacunas ⚠ da spec §13: `nextDueDate` futuro cobra na hora?; cartões de
      recusa `5184019740373151` / `4916561358240741` vêm como `PAYMENT_OVERDUE`
      e/ou `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`; `INACTIVE` + reativar sem
      `nextDueDate` retorna `400`; `DELETE` da assinatura emite
      `PAYMENT_DELETED` das pendentes; tokenização só para cupom/`PUT value`
      (fora do MVP) e política de retry de cartão (assumir 1 tentativa).

## Passo 5 — Checklist pós-deploy

Com o deploy no ar (URL de produção):

- [ ] **Domínio**: configurar `amortiza.me` no provedor, com HTTPS. URLs canônicas, sitemap e PDFs usam `https://amortiza.me`, definido em `src/lib/site.ts`; não derivar URLs públicas do host da requisição ou de previews.
- [ ] **Google OAuth**: cadastrar `https://amortiza.me/api/auth/callback/google` como callback de produção no painel do Google.
- [ ] **SEO**: conferir `/robots.txt`, `/sitemap.xml` e `/opengraph-image`; enviar o sitemap ao Search Console após verificar o domínio. Somente home, juros, custos e blog entram no sitemap; páginas privadas e autenticação usam `noindex`.
- [ ] **Previews**: manter proteção de acesso/noindex no ambiente de preview da hospedagem. Canonical de produção não impede sozinho a indexação de previews.

- [ ] **Cadastro** — criar conta na URL do deploy; conferir no console Neon que o usuário e o bônus (2 créditos, `kind='bonus'`) foram gravados.
- [ ] **Login/logout** — sessão JWT funciona (valida `AUTH_SECRET` estável).
- [ ] **Simulação** — SAC e PRICE funcionam (a conta nova já tem 2 créditos de bônus; sem necessidade de compra).
- [ ] **PDF gate** — exportar PDF após simulação; conferir que o download acontece (usa `@react-pdf/renderer` no runtime Node).
- [ ] **Comparador** — com conta Ilimitado, comparar 2–3 propostas, conferir ranking, alerta de CET, salvar/reabrir/recalcular e PDF.
- [ ] **Créditos fake (compra)** — ⚠️ **não testável no Vercel** (nem em preview): `NODE_ENV=production` em todo deploy da Vercel, e o guard bloqueia `PAYMENT_PROVIDER=fake` em produção (`src/lib/payments/index.ts:9`). Isso é **intencional**. Para testar o fluxo de compra fake, rode localmente: `npm run dev` com `DATABASE_URL` apontando para o Neon e `PAYMENT_PROVIDER=fake`, depois `GET /api/webhooks/payments?userId=<id>&packId=credits10` e confira créditos no `credit_ledger`.
- [ ] **Webhook Asaas (produção)** — migração `0010` aplicada ANTES do deploy; `npx tsx scripts/register-asaas-webhook.ts` rodado com a env de produção; `GET /v3/webhooks` mostra `enabled: true`, `interrupted: false` e a URL `https://amortiza.me/api/asaas/webhook`.

## AVISO IMPORTANTE — PAYMENT_PROVIDER=fake em produção

O guard em `src/lib/payments/index.ts` lança erro se `PAYMENT_PROVIDER=fake` e
`NODE_ENV=production`. Na Vercel isso vale para **qualquer** deploy (preview
também). Consequência: com `fake`, `/api/checkout` e `/api/webhooks/payments`
respondem 500 em produção.

Isso é **intencional** (bloqueia venda sem cobrança real). Para o lançamento
comercial:

1. Implementar/ativar provider real (`StripeProvider`/`AsaasProvider` já existem em `src/lib/payments/`).
2. Configurar chaves de API nos provedores e o webhook real.
3. Trocar `vercel env add PAYMENT_PROVIDER` para `stripe` ou `asaas` (preview + production).

## Mudanças futuras de schema

```bash
npx drizzle-kit generate          # gerar migração a partir de src/db/schema.ts
DATABASE_URL="<neon>" npm run db:migrate   # aplicar no Neon
```

## Resumo de comandos

```bash
npm i -g vercel
vercel login && vercel link
DATABASE_URL="<neon>" npm run db:migrate
DATABASE_URL="<neon>" npx tsx src/db/seed.ts
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET preview      # openssl rand -base64 32
vercel env add AUTH_SECRET production
vercel env add PAYMENT_PROVIDER preview
vercel env add PAYMENT_PROVIDER production
npx tsx scripts/register-asaas-webhook.ts   # registra o webhook Asaas (por ambiente)
vercel && vercel --prod
```
