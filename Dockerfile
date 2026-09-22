# syntax=docker/dockerfile:1

# ---- deps: instala dependências (com devDeps, necessárias no build) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: gera o output standalone (.next/standalone) ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Nenhum segredo é copiado/baked: o build do Next não precisa de env real
# (as conexões são lazy e as rotas são dinâmicas). Os valores chegam em runtime.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: imagem mínima, não-root, só o runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# `public/` é lido em runtime por opengraph-image.tsx (node:fs + process.cwd()).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Release step (railway.json preDeployCommand): migrador runtime + migrações.
# `drizzle-orm` é copiado inteiro para garantir o subpath
# `drizzle-orm/node-postgres/migrator`, que não é traçado pelo Next.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-packs.mjs ./scripts/seed-packs.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
