# Financiamento SaaS — Design (Raio X do Financiamento)

Data: 2026-08-26
Status: Draft para revisão

## 1. Contexto e objetivo

SaaS brasileiro que ajuda pessoa a entender e otimizar financiamento imobiliário, herdado de 3 planilhas do "Amigo do Pai Rico" (simuladores PRICE, SAC e Raio X comparativo).

Objetivo: usuário informa dados do financiamento (saldo devedor, taxa, seguro, TR, parcelas), vê simulação mês a mês nos sistemas SAC e PRICE, e explora interativamente estratégias de amortização (extra pontual, % mensal, FGTS anual, redução de parcela vs prazo, portabilidade) para reduzir custo total e prazo.

Monetização: login obrigatório; 2 créditos de boas-vindas; créditos (R$10 = 10 simulações) ou assinatura ilimitada (R$99,90/mês). Pagamento: Stripe ou Asaas (a definir), abstraído por interface.

Estética: moderna + amigável estilo Nubank (roxo vibrante, cards arredondados, linguagem PT-BR educativa). 100% em português brasileiro.

## 2. Telas

1. **Landing** — explica SAC vs PRICE, CTA para cadastro
2. **Login/Cadastro** — email+senha; +2 créditos no registro
3. **Nova simulação** — wizard de entrada:
   - Dados do financiamento (informados pelo usuário): saldo devedor/valor financiado, taxa de juros, seguro, TR/correção monetária, nº de parcelas (prazo), banco, sistema inicial (SAC ou PRICE)
4. **Resultado (sandbox interativo)** — tela principal:
   - Tabela mês a mês completa (juros, amortização, seguro, saldo devedor, valor útil)
   - Métricas Raio X: CET real, dívida cai em 12m/3 anos/total, dívida além da dívida, parcela paga da dívida, total pago, juros totais
   - Gráficos: saldo devedor, juros vs amortização acumulados, comparação de cenários
   - Experimentos "e se" ao vivo: amortizar valor X no mês Y, % amortização extra mensal, FGTS anual, reduzir parcela vs reduzir prazo, portabilidade (recontratar a taxa T em outro banco)
   - Comparação lado a lado SAC vs PRICE
5. **Estratégia recomendada** — "melhor caminho" com economia em R$ e anos a menos
6. **Minhas simulações** — histórico salvo (reabrir não gasta crédito)
7. **Planos/créditos** — saldo, comprar pacotes, assinatura

## 3. Motor de cálculo (domínio)

Módulo TypeScript puro, sem I/O, fiel às fórmulas das planilhas:

- Entrada: valor financiado, taxa (% a.m. ou a.a.), prazo (meses), TR (ex. 0,17%/mês), seguro (split por parcela, ex. 25/75), banco, sistema
- Sistemas: **SAC** (amortização fixa, parcela decrescente) e **PRICE** (parcela constante), com correção monetária (TR) sobre saldo devedor e seguro por parcela
- Estratégias composíveis: amortização extra pontual em mês específico; % de amortização extra mensal; amortização anual FGTS; escolha redução de parcela vs redução de prazo; portabilidade/refinanciamento
- Saída:
  - Array de parcelas: juros, amortização, seguro, saldo devedor, valor útil
  - Métricas agregadas: CET real, juros totais, total pago, dívida cai em 12m/3 anos/no total, dívida além da dívida, % parcela paga da dívida, economia vs cenário base (R$ e tempo)
- Roda no cliente (UX instantânea do sandbox) e no servidor (persistência, PDF)

**Golden tests obrigatórios**: valores exatos extraídos das planilhas viram testes (ex.: PRICE 100.000 @10% a.a., TR 0,17%, 100 meses → total pago R$ 168.784,09, juros R$ 48.371,80; SAC 396.000 @10,5% → total R$ 1.415.242,80, juros R$ 814.601,51).

## 4. Dados, auth e créditos

- Postgres (Neon) + Drizzle ORM
- Auth.js com email+senha; sessões em banco; pronto para OAuth futuro
- Tabelas:
  - `users` (perfil, papel)
  - `simulations` (cenário + estratégias + snapshot de resultado)
  - `credit_ledger` (extrato: bônus +2, compra, gasto por simulação)
  - `packs` (10 créditos R$10; assinatura ilimitada R$99,90/mês)
  - `subscriptions` (status, id externo do provider)
- Regras de crédito:
  - 1 simulação/sistema = 1 crédito (SAC e PRICE = 2 créditos)
  - Reabrir resultado salvo não gasta crédito
  - Assinante ilimitado: tudo liberado
- Features exclusivas do plano **ilimitado**:
  - Toggle ativo PRICE ↔ SAC no sandbox
  - Exportar tudo em PDF
- Inputs sempre informados pelo usuário: saldo devedor, taxa de juros, seguro, TR, número de parcelas

## 5. Pagamentos

- Interface `PaymentProvider` com implementações Stripe e Asaas (decisão final adiada; seleção por config/env)
- Operações: checkout (créditos e assinatura), webhook (confirmação de pagamento), cancelamento de assinatura, crédito após confirmação
- Pix/cartão conforme provider

## 6. Técnico

- Next.js App Router + TypeScript + Tailwind + shadcn/ui + Recharts
- PDF gerado no servidor (relatório PT-BR com resultado + recomendação)
- Testes: Vitest (motor + golden tests) e Playwright (e2e: cadastro → simular → comprar)
- Deploy: Vercel + Neon; GitHub Actions (lint + test)
- Rate limit em auth/checkout; créditos são o limite natural das simulações

## 7. Fora de escopo (fases futuras)

- Detalhamento fino do modelo de créditos por feature (refinar depois)
- App mobile
- Múltiplos idiomas
