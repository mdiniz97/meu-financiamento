# Cálculos, Formulários e Portabilidade

## Objetivo

Tornar os cálculos financeiros compreensíveis e seguros para usuários sem conhecimento técnico, corrigir erros de unidade e digitação e reorganizar a portabilidade para comparar claramente o contrato atual com a proposta oferecida.

Este trabalho abrange sete frentes relacionadas:

- cálculo direto do valor financiável a partir de uma parcela;
- identificação e conversão do tipo de taxa de juros;
- correção global da entrada monetária;
- correção do aporte recomendado pelo Raio X;
- switches totalmente retos;
- ajuda contextual em todos os campos de entrada das telas autenticadas;
- nova organização da tela de portabilidade.

Ficam fora deste escopo:

- compartilhamento público de simulações;
- importação automática de contratos;
- alteração das fórmulas SAC e PRICE do engine;
- reestruturação completa de todos os formulários sobre uma biblioteca de schemas.

## Princípios

- Unidades financeiras devem ser explícitas nas fronteiras entre domínio e interface.
- O engine deve continuar trabalhando com uma representação canônica de taxa.
- Formulários devem explicar termos sem depender de conhecimento bancário prévio.
- Correções compartilhadas devem ocorrer em componentes compartilhados, não ser repetidas por tela.
- Resultados devem declarar exatamente o que garantem.
- Desktop e mobile devem oferecer o mesmo conteúdo, adaptando apenas a disposição.

## Taxas de Juros

### Representação Canônica

O engine continua recebendo taxa efetiva anual em razão decimal. Exemplo: `0.105` representa `10,5% a.a. efetivos`.

A conversão para taxa efetiva mensal continua sendo:

```text
taxaMensal = (1 + taxaEfetivaAnual)^(1/12) - 1
```

### Formatos Aceitos

Todo campo de taxa contratual passa a ter um seletor de tipo:

- Efetiva anual.
- Nominal anual.
- Efetiva mensal.

Conversões para a representação canônica:

```text
efetiva anual informada:
taxaEfetivaAnual = valor / 100

nominal anual informada:
taxaMensal = (valor / 100) / 12
taxaEfetivaAnual = (1 + taxaMensal)^12 - 1

efetiva mensal informada:
taxaMensal = valor / 100
taxaEfetivaAnual = (1 + taxaMensal)^12 - 1
```

O seletor inicia em `Efetiva anual` para preservar os valores atuais.

### Apresentação

Ao lado do campo, a interface mostra o equivalente calculado em taxa efetiva anual e mensal. Exemplo:

```text
Equivale a 10,50% a.a. efetivos e 0,8355% a.m.
```

Ajuda contextual explica:

- diferença entre taxa efetiva, nominal e mensal;
- como identificar o formato no contrato;
- que CET não substitui a taxa contratual no cronograma;
- que TR é correção monetária separada dos juros.

O CET informado continua sendo tratado como taxa efetiva anual de auditoria e deve ser identificado explicitamente no label e na ajuda. Não recebe seletor nominal/mensal nesta versão.

### Módulo Compartilhado

Um módulo puro deve:

- validar tipo e valor;
- converter qualquer formato aceito para taxa efetiva anual;
- produzir equivalentes efetivo anual e efetivo mensal;
- ser usado por simulação, cálculo inteligente, imóvel no bolso, comparador e portabilidade.

## Valor Financiável Pela Parcela

### Organização

A página e o modal `Qual imóvel cabe no meu bolso?` passam a oferecer dois modos no topo:

- `Por renda e entrada`.
- `Por parcela`.

Não será criada nova rota.

### Por Renda e Entrada

Mantém o comportamento atual:

- renda mensal;
- parcela máxima opcional;
- dinheiro disponível;
- custos iniciais;
- taxa e tipo da taxa;
- TR;
- seguro;
- prazo;
- banco;
- cenários Conservador 20%, Recomendado 25% e Máximo 30%.

A parcela usada em cada cenário continua sendo a menor entre o percentual da renda e a parcela máxima informada.

### Por Parcela

Campos:

- parcela máxima;
- taxa e tipo da taxa;
- TR mensal;
- seguro mensal;
- prazo;
- banco;
- entrada disponível opcional;
- custos iniciais opcionais.

Renda não é obrigatória neste modo.

### Dois Limites

Para PRICE e SAC, resultado mostra dois valores financiáveis:

1. `Máximo pela parcela inicial`: maior principal cuja primeira parcela fica dentro do teto.
2. `Máximo seguro no contrato`: maior principal cuja maior parcela de todo o cronograma fica dentro do teto.

O primeiro valor preserva a inversão direta atual. O segundo usa busca binária sobre o principal e executa o cronograma completo com o engine, incluindo TR e seguro.

Critério do máximo seguro:

```text
max(installments.parcela) <= parcelaMáxima
```

A busca deve usar tolerância monetária documentada, terminar em número limitado de iterações e arredondar o principal para centavos sem ultrapassar o teto.

Se os dois valores forem iguais após arredondamento, a interface pode agrupá-los e informar que a parcela não ultrapassa o teto durante o contrato.

### Resultado

Cada sistema exibe:

- valor financiável pela parcela inicial;
- valor financiável seguro;
- valor máximo do imóvel quando houver entrada líquida;
- primeira parcela;
- maior parcela e mês em que ocorre;
- entrada líquida usada;
- custos iniciais reservados;
- ação `Levar ao simulador` para cada alternativa.

Ajuda contextual deixa claro que o valor seguro é mais conservador quando TR ou estrutura do sistema elevam parcelas futuras.

## Entrada Monetária

### Contrato de Digitação

Campos monetários mantêm o modelo de maquininha:

```text
12345678 -> R$ 123.456,78
```

Os dois últimos dígitos representam centavos.

### Correção

`MoneyInput` deve separar:

- sequência crua de dígitos durante edição;
- valor numérico em reais enviado ao formulário;
- texto formatado usado para apresentação.

Texto formatado, incluindo `,00`, nunca deve voltar a ser interpretado como nova sequência digitada. Focar, desfocar ou selecionar um valor sem alterar não pode multiplicá-lo por 100.

Comportamentos obrigatórios:

- campo vazio aceita digitação da direita para a esquerda;
- selecionar tudo e digitar substitui o valor;
- apagar tudo produz estado vazio/zero conforme contrato do formulário;
- colar valor BRL normalizado não duplica centavos;
- foco e blur sem edição preservam valor;
- limite máximo de dígitos gera estado acessível, não falha silenciosa;
- composição deve funcionar em todos os usos atuais do componente.

Campos monetários ainda implementados com `NumericInput` devem migrar para `MoneyInput` quando a semântica for dinheiro, incluindo portabilidade e estratégias. Percentuais permanecem em input numérico.

## Aporte Recomendado

### Contrato de Unidade

Domínio usa razão decimal:

```text
0.1417 = 14,17%
```

Formulário mostra pontos percentuais:

```text
14.17 = 14,17%
```

Nomes e tipos devem tornar esta diferença explícita. Conversão só acontece na fronteira entre domínio e formulário.

### Aplicação

Ao clicar `Aplicar aporte` no diagnóstico “Amortize por fora todo mês e a dívida cai desde a 1ª parcela”:

- converter razão recomendada para pontos percentuais;
- preservar duas casas decimais;
- substituir a linha percentual existente pelo percentual total necessário;
- criar uma linha percentual se ainda não houver uma;
- não criar múltiplas linhas percentuais que o modelo não consiga representar;
- manter período inicial no primeiro mês aplicável ao diagnóstico.

Exemplo obrigatório:

```text
recomendação do domínio: 0.1417
campo exibido: 14,17%
estratégia enviada ao engine: 0.1417
```

Reidratar controles não pode arredondar `14,17%` para `14%`.

## Switches Retos

O componente compartilhado `Switch` terá:

- trilho com `border-radius: 0`;
- botão interno com `border-radius: 0`;
- estados de foco, contraste, transição e área clicável preservados.

Todos os switches atuais herdam a mudança. Cards, botões, inputs e outros componentes não fazem parte deste requisito, salvo quando usados como toggle equivalente.

## Ajuda Contextual

### Componente Compartilhado

Criar um componente de campo/label com:

- label associado ao input;
- ícone de ajuda;
- texto curto e específico;
- abertura por hover e foco no desktop;
- abertura por clique ou toque no mobile;
- fechamento por `Escape`, clique externo e retorno de foco;
- `aria-describedby` ou associação acessível equivalente;
- suporte a conteúdo um pouco maior quando conceito exigir exemplo.

Tooltip que depende somente de hover não atende o requisito mobile. Implementação pode usar popover responsivo ou primitiva que aceite interação por toque.

### Cobertura

Todos os campos de entrada das telas autenticadas devem receber ajuda específica:

- nova simulação;
- cálculo inteligente;
- imóvel no bolso;
- estratégias de amortização;
- portabilidade;
- comparador de propostas;
- formulários de perfil ou compra quando houver campo cujo efeito não seja óbvio.

Ajuda não deve repetir apenas o label. Deve explicar impacto no cálculo, formato esperado ou onde encontrar o dado.

Prioridade de conteúdo:

- taxa e tipo de taxa;
- TR;
- CET;
- saldo devedor;
- parcela máxima;
- prazo;
- seguro;
- PRICE e SAC;
- entrada e custos iniciais;
- custos da portabilidade;
- reduzir prazo e reduzir parcela;
- aporte percentual, fixo e recorrente;
- inclusão de tarifa no CET.

Labels e explicações devem usar linguagem simples, com termos técnicos somente quando acompanhados de definição curta.

## Portabilidade

### Página

A largura máxima passa de `max-w-3xl` para `max-w-5xl`, com padding menor no mobile.

Ordem do formulário:

1. Dados do financiamento.
2. Contrato atual e proposta oferecida.
3. Busca inteligente.
4. Ação principal.
5. Veredito e resumo.
6. Comparação detalhada.

### Dados do Financiamento

Faixa superior, acima dos dois painéis:

- saldo devedor atual;
- parcelas restantes;
- TR mensal.

Esses dados são compartilhados pelos dois cenários e não devem parecer exclusivos de um painel.

### Painéis

Desktop mostra dois painéis lado a lado.

`Contrato atual` contém:

- banco atual;
- sistema atual;
- taxa atual e tipo;
- seguro atual.

`Proposta oferecida` contém:

- novo banco;
- novo sistema;
- nova taxa e tipo;
- novo seguro;
- custos da portabilidade.

Painel atual usa visual neutro. Proposta oferecida recebe destaque roxo discreto, sem sugerir que já é vencedora.

Mobile empilha:

1. Dados do financiamento.
2. Contrato atual.
3. Proposta oferecida.

Não haverá accordion nesta versão.

### Busca Inteligente

Fica em seção própria abaixo dos painéis. Deve explicar que procura a maior taxa oferecida que ainda gera economia líquida e, quando houver parcela-alvo, o limite que também respeita essa parcela.

Aplicar taxa encontrada atualiza valor e tipo da taxa oferecida de forma coerente e marca resultados antigos como desatualizados.

### Ação Principal

Texto:

```text
Comparar contrato atual e proposta
```

Validação deve identificar o painel e campo com problema. Exceções do engine devem ser convertidas em mensagem compreensível, sem derrubar a página.

### Economia Líquida

Custos entram no resultado econômico:

```text
economiaBruta = totalPagoAtual - totalPagoOferecido
economiaLiquida = economiaBruta - custosPortabilidade
```

Critérios:

- veredito `Vale a pena portar` exige `economiaLiquida > 0`;
- busca inteligente usa economia líquida;
- total da proposta oferecida apresenta parcelas e custos separadamente e também o total combinado;
- payback começa negativo pelos custos e ocorre quando economia mensal acumulada recupera esse valor;
- ausência de payback não pode ser descrita como queda garantida desde a primeira parcela;
- custo zero permite payback imediato quando a parcela oferecida é menor.

### Resultado

Veredito aparece primeiro e mostra:

- se vale a pena;
- economia bruta;
- custos;
- economia líquida;
- prazo de retorno dos custos, quando existir;
- aviso quando custos não são recuperados no prazo.

Resumo repete estrutura dos painéis.

`Contrato atual`:

- parcela inicial;
- maior parcela;
- total pago;
- juros totais;
- prazo.

`Proposta oferecida`:

- parcela inicial;
- maior parcela;
- total das parcelas;
- custos da portabilidade;
- total combinado;
- juros totais;
- prazo.

Comparação detalhada mantém gráfico e tabela, usando duas colunas apenas quando o espaço real comportar. Mobile sempre empilha.

### Resultado Desatualizado

Após calcular, qualquer alteração em campo que afete o resultado:

- preserva resultado anterior para referência;
- exibe estado `Dados alterados — calcule novamente`;
- desabilita ações que dependem de resultado atual, incluindo levar ao simulador;
- remove estado somente após novo cálculo válido.

### Levar ao Simulador

Transfere todos os dados da proposta oferecida:

- principal;
- sistema;
- banco;
- taxa efetiva anual normalizada;
- TR;
- seguro;
- prazo.

Custos de portabilidade não entram no saldo financiado e não são transferidos como amortização.

## Erros e Validação

- Valores monetários não podem ser negativos.
- Taxas devem respeitar limites aceitos pelo engine após normalização.
- Prazo permanece entre 1 e 600 meses.
- Parcela máxima deve ser maior que seguro e demais componentes fixos necessários para haver financiamento positivo.
- Busca de máximo seguro deve retornar estado explicativo quando nenhum principal positivo cabe no teto.
- Inputs inválidos mantêm último valor válido somente quando isso estiver visível; não podem recalcular silenciosamente com dado antigo.
- Mensagens devem indicar ação corretiva, não apenas “valor inválido”.

## Arquitetura

### Domínio Puro

- Normalização de taxas.
- Inversão pela parcela inicial.
- Busca do máximo seguro pelo cronograma.
- Cálculo de economia líquida de portabilidade.
- Conversões explícitas entre razão e pontos percentuais.

Nenhum desses módulos depende de React, DOM ou banco.

### Componentes Compartilhados

- `MoneyInput` corrigido.
- Campo com label e ajuda acessível.
- Seletor de tipo de taxa.
- `Switch` reto.
- Componentes de resultado do valor financiável.

### Fluxos

- Affordability reutiliza domínio nos dois modos.
- Simulação, comparador e portabilidade normalizam taxa antes de montar `LoanInput`.
- StrategyControls adapta unidade do aporte somente na fronteira da UI.
- Portabilidade mantém cálculo em módulo puro e apresentação no client component.

## Testes

### Unitários

- Conversão de efetiva anual, nominal anual e mensal.
- Equivalentes conhecidos e casos de taxa zero.
- Valor máximo pela parcela inicial para PRICE e SAC.
- Valor máximo seguro sem ultrapassar teto em nenhum mês.
- Efeito de TR na diferença entre máximo inicial e seguro.
- Parcela menor ou igual aos custos fixos.
- Entrada líquida e valor máximo do imóvel.
- Aporte `0.1417 -> 14.17 -> 0.1417`.
- Substituição de aporte percentual existente.
- Preservação de duas casas na reidratação.
- Economia líquida incluindo custos.
- Busca inteligente de portabilidade incluindo custos.
- Payback inexistente quando custos não são recuperados.

### Componentes

- `MoneyInput`: digitação, seleção total, colagem, exclusão, foco e blur.
- Ajuda: teclado, mouse e toque; associação acessível.
- Seletor de taxa e equivalentes exibidos.
- Switch sem raio no trilho e botão.
- Estado desatualizado da portabilidade.

### E2E

- Modo por parcela calcula os dois limites e leva alternativa ao simulador.
- Taxa nominal e mensal produzem equivalentes corretos.
- Entrada monetária não acrescenta `00` ao editar valor.
- Aplicar aporte mostra e aplica percentual correto.
- Todos os fluxos principais expõem ajuda por clique e teclado.
- Portabilidade desktop mostra faixa superior e painéis lado a lado.
- Portabilidade mobile empilha na ordem aprovada e não cria overflow horizontal.
- Custos mudam veredito e busca inteligente.
- Alterar dado após cálculo bloqueia ação baseada em resultado antigo.
- Levar proposta transfere todos os campos esperados.

## Critérios de Aceite

- Usuário consegue descobrir quanto financia somente com uma parcela, sem informar renda.
- Resultado diferencia claramente teto inicial e teto seguro durante todo o contrato.
- Usuário sabe qual tipo de taxa informar e vê equivalentes usados no cálculo.
- Digitar `12345678` em campo monetário resulta em `R$ 123.456,78`, sem multiplicação no foco ou blur.
- Aporte recomendado de `14,17%` chega ao engine como `0.1417` e faz dívida cair desde a primeira parcela no cenário diagnosticado.
- Todos switches têm trilho e botão interno com cantos retos.
- Todo campo de entrada autenticado possui ajuda acionável por mouse, teclado e toque.
- Portabilidade mostra dados compartilhados acima e Atual/Oferecido lado a lado no desktop.
- Veredito de portabilidade usa economia líquida após custos.
- Resultados desatualizados são identificados e não podem alimentar o simulador.
- Suítes unitária, de componentes, e2e, lint e build passam.
