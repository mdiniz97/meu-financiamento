export interface FaqItem {
  q: string;
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: "Qual a diferença entre SAC e PRICE?",
    a: "No SAC a amortização é fixa: a parcela começa maior e cai todo mês, e a dívida abate desde a primeira parcela. No PRICE a parcela é constante, mas no começo quase tudo é juro, e com a correção (TR) a dívida pode até crescer nos primeiros anos. No total, o SAC costuma pagar bem menos juros.",
  },
  {
    q: "O que é a análise do financiamento?",
    a: "É uma análise que mostra em que mês a sua dívida começa a cair de verdade, a parcela mínima que ainda abate o saldo e o prazo ideal para o seu financiamento. Com ela você entende se a sua parcela atual está pagando a dívida ou só os juros.",
  },
  {
    q: "O que é o amortizador inteligente?",
    a: "Você informa quanto pode pagar por mês e o sistema descobre o melhor modelo (SAC ou PRICE), o melhor prazo e o melhor aporte mensal para o seu orçamento, minimizando o total pago. Também mostra quanto você conseguiria financiar com a sua renda.",
  },
  {
    q: "Vale a pena amortizar o financiamento?",
    a: "Sim, quase sempre. Cada real amortizado deixa de render juros até o fim do contrato: uma amortização pequena pode economizar muitas vezes o seu valor em juros. O simulador mostra exatamente quanto você economiza e o quanto o prazo encurta.",
  },
  {
    q: "Vale mais investir ou amortizar?",
    a: "Depende das taxas. A calculadora compara três estratégias com o mesmo dinheiro: reduzir a parcela, reduzir o prazo, ou investir na Selic e usar o rendimento para amortizar. Mostra quanto de juros cada uma economiza até quitar e, no caso de investir, que você mantém o valor investido no bolso. Amortizar é retorno garantido da taxa do contrato; investir depende da Selic, que muda a cada Copom.",
  },
  {
    q: "O que é juros de obra?",
    a: "Quem compra na planta paga, durante a construção, apenas os juros sobre o valor que o banco já liberou, sem amortizar o saldo, além do seguro de obra. Só depois da entrega a parcela vira a cheia (juros + amortização). A simulação de comprar na planta estima esse custo até a entrega, inclusive se a obra já está em andamento.",
  },
  {
    q: "Comprar na planta ou investir até a entrega?",
    a: "A seção 'Planta ou investir' compara o que você desembolsa comprando (juros de obra, seguro e o custo da entrada parcelada) com o rendimento da sua entrada investida na Selic até a entrega. Investindo, você mantém o dinheiro no bolso e pode pagar a entrada depois, dar de entrada num imóvel pronto ou abater o saldo.",
  },
  {
    q: "O que é portabilidade e como saber se compensa?",
    a: "Portabilidade é trocar o financiamento de banco por uma taxa menor. O simulador compara manter o contrato atual com portar para a nova taxa, mostra a economia total, a diferença de parcela e o mês em que os custos da portabilidade se pagam.",
  },
  {
    q: "Quanto custa cada simulação?",
    a: "Cada simulação completa (juros de obra, investir ou amortizar, imóvel no bolso e portabilidade) usa 1 crédito. O pacote de 5 créditos custa R$ 10,00 e você ganha 10 créditos de boas-vindas ao criar a conta. No plano Ilimitado, tudo é liberado sem consumir créditos.",
  },
  {
    q: "Os créditos expiram? E as simulações salvas?",
    a: "Créditos nunca expiram. As simulações são salvas automaticamente: no plano de créditos elas ficam disponíveis por 6 horas, e no Ilimitado enquanto a assinatura estiver ativa.",
  },
  {
    q: "O que o plano Ilimitado inclui?",
    a: "R$ 18,90 por mês ou R$ 119,90 por ano: simulações ilimitadas sem consumir créditos, amortizador inteligente, comparação PRICE e SAC lado a lado, portabilidade, exportação da análise do financiamento em PDF e simulações salvas enquanto você for assinante. O anual equivale a R$ 9,99 por mês e é cobrado de uma vez por ano. Cancele quando quiser, sem multa.",
  },
  {
    q: "De onde vêm os juros de mercado?",
    a: "A página de juros de mercado busca direto do Banco Central do Brasil: Selic, IPCA e TR (séries SGS) e as taxas médias dos financiamentos por instituição (Olinda). São dados oficiais, atualizados ao longo do dia.",
  },
  {
    q: "Preciso criar conta para usar?",
    a: "Sim, ao criar a conta você ganha 10 créditos de boas-vindas para testar. Depois, é só escolher entre créditos avulsos (R$ 10 por 5 simulações) ou o plano Ilimitado mensal (R$ 18,90/mês) ou anual (R$ 119,90/ano).",
  },
];
