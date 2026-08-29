# Deploy — Vercel + Neon

Guia passo a passo para publicar o **Meu Financiamento** em produção (Vercel)
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
```

| Variável | Valor | Detalhe |
| -------- | ----- | ------- |
| `DATABASE_URL` | connection string do Neon | mesma para preview e production |
| `AUTH_SECRET` | `openssl rand -base64 32` | **mesmo valor nos dois ambientes** — se mudar, todas as sessões são invalidadas |
| `AUTH_GOOGLE_ID` | id do OAuth Google | credenciais em console.cloud.google.com |
| `AUTH_GOOGLE_SECRET` | secret do OAuth Google | mesmo valor nos dois ambientes |
| `PAYMENT_PROVIDER` | `fake` | dev/preview; em produção ver AVISO abaixo |

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

## Passo 5 — Checklist pós-deploy

Com o deploy no ar (URL de produção):

- [ ] **Cadastro** — criar conta na URL do deploy; conferir no console Neon que o usuário e o bônus (2 créditos, `kind='bonus'`) foram gravados.
- [ ] **Login/logout** — sessão JWT funciona (valida `AUTH_SECRET` estável).
- [ ] **Simulação** — SAC e PRICE funcionam (a conta nova já tem 2 créditos de bônus; sem necessidade de compra).
- [ ] **PDF gate** — exportar PDF após simulação; conferir que o download acontece (usa `@react-pdf/renderer` no runtime Node).
- [ ] **Comparador** — com conta Ilimitado, comparar 2–3 propostas, conferir ranking, alerta de CET, salvar/reabrir/recalcular e PDF.
- [ ] **Créditos fake (compra)** — ⚠️ **não testável no Vercel** (nem em preview): `NODE_ENV=production` em todo deploy da Vercel, e o guard bloqueia `PAYMENT_PROVIDER=fake` em produção (`src/lib/payments/index.ts:9`). Isso é **intencional**. Para testar o fluxo de compra fake, rode localmente: `npm run dev` com `DATABASE_URL` apontando para o Neon e `PAYMENT_PROVIDER=fake`, depois `GET /api/webhooks/payments?userId=<id>&packId=credits10` e confira créditos no `credit_ledger`.

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
vercel && vercel --prod
```
