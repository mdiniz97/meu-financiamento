# Landing: abas clicáveis no preview + balanceamento SAC/PRICE

**Data:** 2026-08-28
**Branch:** `main` (direto, sem worktree)
**Status:** aprovado, aguardando plano de implementação

## Contexto

Duas melhorias de conteúdo na landing page, ambas pequenas e independentes:

1. `DashboardPreview` (seção "Veja o que você encontra na análise completa") tem uma barra lateral com 4 itens (Visão geral, Comparativo, Amortização, Gráficos) que hoje são só texto estático — só "Comparativo" aparece destacado, e o conteúdo à direita nunca muda. Viram abas de verdade, clicáveis.
2. `SystemsExplain` (seção "SAC vs PRICE: a diferença custa caro") lista 4 pontos sobre PRICE, todos neutros/cautelosos, e nenhum destaca a vantagem real do PRICE (parcela inicial menor). Fica com viés "SAC bom, PRICE ruim". Adiciona um ponto a favor do PRICE pra equilibrar.

## 1. `DashboardPreview` — abas clicáveis

Vira Client Component (`"use client"`, `useState` pro índice da aba ativa, default = `1` ou seja "Comparativo", mantendo o destaque atual). Cada aba mostra um painel diferente à direita, reaproveitando os dados já calculados por `simulate()` no topo do arquivo (nenhuma nova chamada ao motor, só reformatação):

- **Visão geral**: resumo compacto — parcela inicial PRICE, parcela inicial SAC, diferença total (economia) em destaque. Sem tabela.
- **Comparativo**: a tabela que já existe hoje (parcela inicial / amortização na 1ª parcela / juros totais em 30 anos), inalterada.
- **Amortização**: tabela nova comparando a amortização de PRICE × SAC nos meses 1, 12, 60, 120 e 360 (`installments[0]`, `installments[11]`, `installments[59]`, `installments[119]`, `installments[359]`), mesma linguagem visual (grid com bordas, `font-mono tabular-nums`) da tabela de Comparativo.
- **Gráficos**: o SVG de linhas que já existe hoje, exclusivo dessa aba (hoje ele aparece sempre, junto com a tabela de Comparativo — deixa de ser sempre-visível).

A barra lateral (`sidebarItems`) vira botões (`<button type="button">`) em vez de `<span>`, com o item ativo destacado (mesmo estilo `font-semibold text-primary` que "Comparativo" já tem hoje).

## 2. `SystemsExplain` — ponto a favor do PRICE

Adiciona ao array `pricePoints` (mantém os 4 pontos existentes, que são factualmente corretos, só faltava contrapeso):

> "Parcela inicial menor que o SAC — mais fácil de caber no orçamento e na aprovação do crédito"

Posição: primeiro item da lista (é a vantagem mais direta e concreta do PRICE, faz sentido vir antes dos pontos de atenção).

## Fora de escopo

- Nenhuma mudança de token/paleta/tipografia.
- Nenhuma mudança no motor de cálculo (`simulate()`, `priceBreakEven()`) — só reformatação de dados já calculados.
- `sacPoints` não muda.

## Verificação

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` sem regressão.
- Checagem manual: clicar nas 4 abas do preview muda o conteúdo corretamente, aba ativa fica destacada; ponto novo do PRICE aparece primeiro na lista.
