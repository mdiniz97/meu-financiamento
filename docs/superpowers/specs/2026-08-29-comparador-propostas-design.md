# Comparador de Propostas Bancárias

## Objetivo

Adicionar ao app uma área exclusiva do plano Ilimitado para comparar até três propostas de financiamento imobiliário. O comparador deve recalcular cada proposta com o engine SAC/PRICE existente, auditar o CET informado pelo banco, ordenar as propostas pelo custo total da aquisição e mostrar quanto o amortizador inteligente pode reduzir o custo de cada alternativa.

O recurso deve ajudar o usuário a tomar e documentar uma decisão entre propostas reais, não apenas comparar taxas isoladas.

## Escopo da Primeira Versão

- Página própria `/comparar-propostas` dentro da área autenticada.
- Link na navbar autenticada.
- Acesso exclusivo do plano Ilimitado, sem consumo adicional de créditos.
- Duas propostas abertas inicialmente e uma terceira opcional.
- Cálculo completo de SAC ou PRICE por proposta.
- Ranking pelo menor custo total da aquisição.
- Auditoria entre CET informado e CET recalculado.
- Análise adicional com amortizador inteligente usando um orçamento mensal comum.
- Salvamento, reabertura, recálculo e exclusão de comparações.
- PDF comparativo.
- Ação para levar uma proposta ao simulador completo.

Ficam fora deste escopo:

- Mais de três propostas por comparação.
- Compartilhamento público por link.
- Cobrança por comparação ou PDF.
- Importação automática de PDFs ou propostas de bancos.
- Histórico mensal do contrato realizado.

## Acesso E Monetização

Todas as camadas devem validar assinatura Ilimitado ativa:

- Página `/comparar-propostas`.
- APIs de salvar, reabrir, recalcular e excluir.
- Geração de PDF.

Usuário autenticado sem plano Ilimitado vê um preview bloqueado do recurso e o `UpgradeDialog`. O cliente não pode ser a única barreira de acesso.

Salvar comparações e gerar PDFs não consomem créditos nesta versão.

## Fluxo Principal

1. Usuário abre `/comparar-propostas`.
2. Tela começa com duas propostas editáveis lado a lado.
3. Usuário pode adicionar uma terceira proposta.
4. Usuário informa um orçamento mensal único para a análise do amortizador inteligente.
5. Usuário preenche os dados completos de cada proposta.
6. Botão `Comparar propostas` valida todos os cards.
7. Com todas as propostas válidas, sistema calcula cronogramas, CETs, ranking original e ranking com amortizador.
8. Usuário pode salvar a comparação, gerar PDF ou levar uma proposta ao simulador.
9. Comparações salvas aparecem abaixo do comparador, na mesma página.

Resultados não atualizam enquanto o usuário digita. Todo recálculo explícito acontece pelo botão `Comparar propostas` ou `Recalcular`.

## Layout

Layout escolhido: uma página com propostas lado a lado e resultados abaixo.

### Desktop

- Cabeçalho da página com título, explicação curta e badge `Ilimitado`.
- Campo comum `Quanto consegue pagar por mês?`.
- Grid de dois ou três cards de proposta.
- Botão `Adicionar terceira proposta` enquanto houver menos de três cards.
- Ação principal `Comparar propostas` após os cards.
- Resultado abaixo: vencedor, métricas, ranking, alertas CET, gráficos, análise inteligente e ações.
- Seção `Comparações salvas` no fim da página.

### Mobile

- Cards empilhados.
- Identificação persistente por número e banco (`Proposta 1 · Caixa`).
- Resultado em cards verticais; tabelas usam scroll horizontal somente quando necessário.
- Ação principal permanece visível após o último card, não como botão flutuante.

## Dados de Cada Proposta

Cada proposta contém:

- Banco.
- Nome opcional da proposta.
- Valor do imóvel.
- Entrada.
- Valor financiado.
- Opção `Ajustar manualmente` para o valor financiado.
- Sistema `SAC` ou `PRICE`.
- Prazo em meses.
- Taxa contratual anual.
- CET anual informado pelo banco.
- TR mensal.
- Seguro mensal.
- Lista editável de tarifas.

Valor financiado padrão é `valor do imóvel - entrada`. Ao ativar o ajuste manual, o usuário informa outro valor. Se o valor manual não fechar com imóvel e entrada, a interface e o resultado exibem aviso, mas o cálculo usa o valor manual.

## Tarifas

Tarifas são uma lista editável por proposta. Categorias iniciais:

- Avaliação do imóvel.
- Tarifa bancária.
- Cartório.
- Seguro ou custo adicional inicial.
- Outra.

Cada item contém descrição, valor e checkbox `Incluir no cálculo do CET`.

Padrões:

- Avaliação e tarifa bancária: incluídas no CET.
- Cartório: não incluído no CET.
- Seguro ou custo adicional: escolha explícita do usuário.
- Outra: desmarcada por padrão.

Todas as tarifas entram no custo total da aquisição, independentemente do checkbox. O checkbox controla apenas o fluxo usado no CET recalculado.

## Cálculo de Cada Proposta

O engine SAC/PRICE existente gera o cronograma a partir de:

- Valor financiado.
- Sistema.
- Prazo.
- Taxa contratual.
- TR.
- Seguro mensal.

O CET informado não substitui a taxa contratual. Ele serve como dado de auditoria.

### Custo Total da Aquisição

`entrada + total das parcelas + seguros + tarifas`

Como o engine já inclui seguro mensal no total das parcelas, a implementação não deve somá-lo novamente. `Total das parcelas` neste documento significa o total pago produzido pelo engine, incluindo seguro e correção. As tarifas são adicionadas separadamente.

### Custo por R$ 100 Mil Financiados

`(custo total do financiamento / valor financiado) * 100.000`

Para este indicador, `custo total do financiamento` exclui a entrada e inclui parcelas, seguros e tarifas. Isso permite comparar propostas com valores financiados diferentes sem confundir o ranking principal.

### CET Recalculado

O CET é calculado por IRR dos fluxos:

- No período zero, crédito líquido recebido: valor financiado menos tarifas marcadas para inclusão no CET.
- Nos períodos seguintes, saídas mensais do cronograma, incluindo parcela, seguro e correção aplicável.

O CET mensal encontrado é convertido para taxa anual efetiva.

CET informado e CET recalculado são arredondados para duas casas decimais. Qualquer diferença após o arredondamento gera alerta. Exemplo: `9,80%` versus `9,81%` alerta; diferenças invisíveis na segunda casa não alertam.

O alerta não invalida a proposta e não altera o ranking. Ele informa que os dados cadastrados não reproduzem o CET anunciado.

## Ranking

### Ranking Principal

Critério: menor custo total da aquisição.

Resultado mostra:

- Posição de cada proposta.
- Proposta vencedora.
- Diferença em reais para cada concorrente.
- Custo total da aquisição.
- Custo do financiamento.
- Custo por R$ 100 mil financiados.
- Parcela inicial.
- Prazo de quitação.
- CET informado e recalculado.

### Ranking Com Amortizador Inteligente

O usuário informa um orçamento mensal único, aplicado a todas as propostas. Para cada proposta, o sistema usa o módulo inteligente existente para avaliar:

- Redução de prazo.
- Redução de parcela.
- Melhor custo total dentro do orçamento.

Este ranking fica separado do ranking principal. O ranking principal sempre compara as condições originais oferecidas pelos bancos; o ranking inteligente mostra o potencial após estratégia de aportes.

Se o orçamento não comportar uma proposta, ela recebe aviso específico e continua no ranking original.

## Resultado Visual

O resultado contém:

- Card de recomendação com vencedor e economia para a segunda colocada.
- Ranking das propostas.
- Métricas principais.
- Alertas de CET e inconsistência do valor financiado.
- Gráfico de saldo devedor das propostas originais.
- Gráfico do amortizador inteligente, com estratégia recomendada em roxo.
- Resumo de por que a proposta venceu.
- Ações `Salvar comparação`, `Gerar PDF` e `Levar ao simulador`.

`Levar ao simulador` usa valor financiado, sistema, prazo, taxa, TR, seguro, banco e, quando aplicável, estratégia inteligente da proposta escolhida.

## Persistência

Nova tabela `proposal_comparisons`:

- `id`: UUID.
- `userId`: UUID com FK para `users` e exclusão em cascata.
- `name`: texto.
- `monthlyBudget`: valor monetário em centavos ou decimal normalizado.
- `proposals`: JSON versionado com as entradas.
- `result`: JSON versionado com snapshot do resultado calculado.
- `engineVersion`: texto.
- `createdAt`: timestamp.
- `updatedAt`: timestamp.

Entradas e resultado são persistidos. Ao reabrir:

- Mostrar o snapshot original imediatamente.
- Indicar data e versão do engine.
- Oferecer `Recalcular`.
- Se o novo resultado mudar, mostrar aviso antes de substituir o snapshot salvo.

Comparações salvas ficam listadas na própria página com nome, vencedor, economia, data, ações de abrir e excluir.

## Módulos

### Cálculo Puro

Novo módulo de domínio, sem React ou banco, responsável por:

- Validar entradas normalizadas.
- Calcular cada proposta pelo engine existente.
- Recalcular CET.
- Calcular ranking principal.
- Calcular custo por R$ 100 mil.
- Rodar amortizador inteligente por proposta.
- Produzir resultado serializável compartilhado por tela, persistência e PDF.

### Página E Componentes

- Página server `/comparar-propostas`: autenticação e gate Ilimitado.
- Formulário client do comparador.
- Card editável de proposta.
- Editor de tarifas.
- Resultado e ranking.
- Lista de comparações salvas.
- Preview bloqueado para não assinantes.

### API/Actions

Operações server-side autenticadas:

- Criar/salvar comparação.
- Listar comparações do usuário.
- Carregar comparação própria.
- Recalcular comparação.
- Excluir comparação própria.
- Gerar PDF.

Cada operação valida propriedade do registro, plano Ilimitado e limite de três propostas.

## PDF

PDF usa o snapshot exibido e inclui:

- Nome e data da comparação.
- Entradas de cada proposta.
- Ranking principal.
- Custo total da aquisição.
- Custo por R$ 100 mil financiados.
- CET informado versus recalculado e alertas.
- Gráficos/resumos equivalentes em formato compatível com PDF.
- Ranking com amortizador inteligente.
- Premissas e observação de que os números dependem dos dados informados.

## Validação E Erros

Regras mínimas:

- Duas ou três propostas.
- Bancos podem repetir; nomes identificam propostas distintas.
- Valor do imóvel maior que zero.
- Entrada não negativa e menor que o valor do imóvel.
- Valor financiado maior que zero.
- Prazo entre 1 e 600 meses.
- Taxa contratual e CET entre 0% e 100% ao ano.
- TR mensal entre 0% e 100%.
- Seguro e tarifas não negativos.
- Orçamento mensal maior que zero.

Erros de preenchimento aparecem no card correspondente. O ranking só é produzido quando todas as propostas estão válidas. Falha do amortizador inteligente em uma proposta não invalida o ranking original.

## Segurança

- Todas as consultas filtram por `userId` da sessão.
- IDs do cliente nunca bastam para autorização.
- Gate Ilimitado é revalidado em cada operação protegida.
- JSON salvo passa por validação de schema antes de cálculo ou renderização.
- PDF não aceita snapshot arbitrário do cliente; usa registro próprio salvo ou resultado recalculado server-side.

## Testes

### Unitários

- Custo total com entradas diferentes.
- Custo por R$ 100 mil.
- Ranking e desempate determinístico.
- CET com tarifas incluídas e excluídas.
- Alerta de diferença na segunda casa decimal.
- Valor financiado automático e manual.
- Amortizador com orçamento comum.
- Proposta inviável no orçamento sem quebrar ranking original.
- Máximo de três propostas.
- Serialização/versionamento de entrada e resultado.

### Integração

- Persistência e propriedade por usuário.
- Gate Ilimitado em todas as actions/APIs.
- Reabertura do snapshot.
- Recálculo com confirmação de mudança.
- PDF baseado no snapshot correto.

### E2E

- Não assinante vê bloqueio e upgrade.
- Ilimitado compara duas propostas.
- Adiciona terceira proposta.
- Divergência de CET gera alerta.
- Salva, reabre e exclui comparação.
- Gera PDF.
- Leva proposta ao simulador com dados preenchidos.
- Fluxo responsivo básico em mobile.

## Sequência Posterior

Após entregar o comparador:

1. Projetar e implementar `Qual imóvel cabe no meu bolso?`.
2. Discutir design do link compartilhável de simulação/comparação.

Esses recursos não fazem parte deste documento.
