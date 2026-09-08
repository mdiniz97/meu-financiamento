import type { Article } from './types';

const artigo: Article = {
  slug: 'quitar-financiamento-antes',
  title: 'Quitar o financiamento antes: vale a pena pagar aporte extra?',
  description:
    'Entenda como aportes reduzem a dívida, compare prazo e prestação e veja um exemplo PRICE de quitação em dez anos, com premissas e cuidados para o orçamento.',
  updatedAt: '2026-09-08',
  cta: { label: 'Calcular meu aporte para quitar antes', href: '/meta-de-quitacao' },
  blocks: [
    {
      type: 'p',
      text: 'Pagar um valor extra pode antecipar a quitação e reduzir bastante os juros futuros. Mas a melhor meta não é a mais curta que uma calculadora permite: é aquela que cabe no orçamento sem consumir a reserva nem colocar o pagamento obrigatório em risco.',
    },
    {
      type: 'p',
      text: 'O aporte não precisa superar o valor da parcela para ajudar. O importante é direcioná-lo ao saldo devedor, entender como o banco recalcula o contrato e acompanhar o plano ao longo do tempo.',
    },
    { type: 'h2', text: 'Como o aporte extra reduz a dívida' },
    {
      type: 'p',
      text: 'Uma prestação inclui juros e amortização, além dos encargos previstos no contrato. O aporte extraordinário destinado ao principal reduz esse saldo adicionalmente. Com menos dívida, os juros dos períodos seguintes passam a incidir sobre uma base menor. Pagar o boleto comum antes do vencimento não deve ser confundido com solicitar amortização extraordinária.',
    },
    {
      type: 'p',
      text: 'O artigo 52, parágrafo 2º, do Código de Defesa do Consumidor assegura a liquidação antecipada, total ou parcial, com redução proporcional dos juros e demais acréscimos. Isso não significa devolução de todos os juros já pagos nem aplicação de um desconto arbitrário sobre o saldo.',
    },
    { type: 'h2', text: 'Reduzir prazo ou prestação?' },
    {
      type: 'p',
      text: 'A Caixa descreve duas opções de amortização. A escolha muda o objetivo do aporte e precisa constar na solicitação ao banco:',
    },
    {
      type: 'table',
      caption: 'Duas formas de usar a amortização extraordinária',
      headers: ['Opção', 'O que muda', 'Objetivo principal'],
      rows: [
        ['Reduzir prazo', 'Diminui o número de prestações restantes', 'Antecipar o fim do financiamento'],
        ['Reduzir prestação', 'Diminui a prestação, mantendo o prazo', 'Aliviar o compromisso mensal'],
      ],
    },
    {
      type: 'p',
      text: 'Mantidas as demais condições e sem reaplicar a folga mensal, reduzir prazo tende a cortar mais juros futuros. Reduzir prestação pode ser mais útil quando o orçamento está apertado. Se você pretende usar a folga para novos aportes, simule esse comportamento explicitamente: não compare estratégias com desembolsos diferentes como se fossem iguais.',
    },
    { type: 'h2', text: 'Exemplo PRICE: de 30 para 10 anos' },
    {
      type: 'p',
      text: 'Este exemplo usa exclusivamente o sistema PRICE. Partimos de um saldo devedor de R$ 400.000,00, com 360 meses restantes, e calculamos um plano para liquidá-lo em 120 meses. Não estamos comparando o preço do imóvel nem somando pagamentos que já aconteceram.',
    },
    {
      type: 'ul',
      items: [
        'Juros de 10,5% efetivos ao ano, constantes em todo o cálculo.',
        'Taxa mensal equivalente de aproximadamente 0,835515568%, obtida pela raiz de ordem 12 de 1,105, menos 1.',
        'Pagamentos mensais ao final de cada período, começando um mês depois da data do saldo.',
        'Sem TR, IPCA, seguros, tarifas, atrasos ou renegociação da taxa.',
        'Sem aporte inicial ou novos aportes pontuais: apenas a prestação e o complemento mensal calculado, sem FGTS ou décimo terceiro.',
      ],
    },
    {
      type: 'p',
      text: 'A fórmula PRICE divide o saldo multiplicado pela taxa mensal por um menos o inverso do fator de capitalização elevado ao número de meses. Com a mesma taxa, calculamos o pagamento para 360 e para 120 meses, mantendo a precisão integral e arredondando somente a apresentação.',
    },
    {
      type: 'table',
      caption: 'Comparação PRICE sem correção monetária ou encargos adicionais',
      headers: ['Medida', 'Prazo de 360 meses', 'Meta de 120 meses'],
      rows: [
        ['Pagamento mensal de principal e juros', 'R$ 3.518,03', 'R$ 5.291,83'],
        ['Complemento mensal em relação ao plano original', 'R$ 0,00', 'R$ 1.773,80'],
        ['Soma nominal dos pagamentos futuros', 'R$ 1.266.490,52', 'R$ 635.019,79'],
        ['Juros futuros totais', 'R$ 866.490,52', 'R$ 235.019,79'],
      ],
    },
    {
      type: 'p',
      text: 'No modelo, somar cerca de R$ 1.773,80 à prestação-base de R$ 3.518,03 permite manter R$ 5.291,83 mensais para principal e juros. O complemento é menor que a parcela e ainda assim faz diferença. Se o banco recalcular a prestação-base, será necessário recalcular o complemento para preservar o desembolso planejado.',
    },
    { type: 'h2', text: 'O que significa a economia do exemplo' },
    {
      type: 'p',
      text: 'A diferença entre os juros futuros dos dois planos é de R$ 631.470,73. Como ambos devolvem o mesmo principal de R$ 400.000,00, essa também é a diferença entre as somas dos pagamentos. O plano curto exige mais dinheiro por mês, mas termina vinte anos antes.',
    },
    {
      type: 'note',
      text: 'Essa economia é uma soma nominal distribuída por décadas. Não é dinheiro devolvido, saldo disponível para saque ou desconto à vista. O cálculo não traz os fluxos a valor presente e não mede o rendimento de uma alternativa de investimento. Os valores arredondados podem produzir diferenças de centavos se multiplicados manualmente.',
    },
    { type: 'h2', text: 'Por que não repetir esse aporte no SAC' },
    {
      type: 'p',
      text: 'No SAC sem correção, a amortização programada é constante e os juros caem conforme o saldo diminui. Aportes adicionais e o recálculo do banco podem alterar saldo, prazo e prestações seguintes. Por isso, um complemento fixo sobre o boleto não equivale a manter um pagamento total fixo.',
    },
    {
      type: 'p',
      text: 'Não extrapole o exemplo PRICE para o SAC. Um aporte mínimo calculado apenas para o primeiro mês não garante a quitação na meta quando repetido. É preciso projetar cada mês, respeitar os boletos obrigatórios e atualizar a simulação depois das amortizações e correções contratuais.',
    },
    { type: 'h2', text: 'Quando convém preservar o dinheiro' },
    {
      type: 'p',
      text: 'Antes de acelerar o financiamento, preserve recursos para despesas essenciais e imprevistos. Considere renda variável, dependentes, manutenção do imóvel e gastos anuais. Evitar juros imobiliários não ajuda se o aporte obrigar você a recorrer a crédito mais caro para pagar contas básicas.',
    },
    {
      type: 'p',
      text: 'Também compare o rendimento líquido de alternativas de investimento, com impostos, riscos e prazo compatíveis. Não decida pela taxa bruta anunciada. Se o complemento mensal ficar pesado, alongue a meta ou planeje aportes pontuais apenas quando houver sobra, sem contar antecipadamente com bônus incertos.',
    },
    { type: 'h2', text: 'FGTS exige uma análise separada' },
    {
      type: 'p',
      text: 'O saldo vinculado do FGTS não é recurso livre para aplicar onde você quiser. Seu uso habitacional depende do enquadramento do trabalhador, do imóvel e do financiamento. Existem exigências de tempo sob o regime, titularidade e intervalos entre utilizações, além de outras condições que o agente financeiro precisa verificar.',
    },
    {
      type: 'p',
      text: 'Amortizar o saldo, liquidar o contrato e pagar parte das prestações são modalidades diferentes. Confirme qual atende seu objetivo, a documentação e as regras vigentes antes de incluir o FGTS no plano. Não trate futuras liberações como certas nem substitua a reserva de emergência por um saldo sem disponibilidade imediata.',
    },
    { type: 'h2', text: 'Checklist para executar o plano' },
    {
      type: 'ol',
      items: [
        'Peça saldo atualizado e demonstrativo da evolução da dívida, com taxa, indexador, sistema e prazo restante.',
        'Separe o valor mensal sustentável depois da reserva, das despesas e do boleto obrigatório.',
        'Solicite simulações de redução de prazo e de prestação para a mesma data e quantia.',
        'Peça expressamente abatimento do principal e confirme a opção escolhida antes de emitir o pagamento adicional.',
        'Pague integralmente o boleto obrigatório. O aporte extra não autoriza pagar menos do que o banco cobra.',
        'Confira comprovante, processamento, novo saldo e cronograma. Reavalie a meta após cada mudança relevante.',
      ],
    },
    { type: 'h2', text: 'Como calcular uma meta possível' },
    {
      type: 'p',
      text: 'Na ferramenta de meta de quitação do amortiza.me, use saldo, taxa e prazo reais para explorar o esforço mensal. O acesso exige login e Plano Ilimitado. Trate o resultado como estimativa conforme as premissas exibidas, não como instrução de pagamento: confirme o plano com seu banco.',
    },
    {
      type: 'links',
      items: [
        { label: 'Calcular meu aporte para quitar antes', href: '/meta-de-quitacao' },
        { label: 'Entender as diferenças entre SAC e PRICE', href: '/blog/sac-ou-price' },
        { label: 'Comparar investimento e amortização', href: '/blog/selic-alta-investir-ou-amortizar' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Preciso juntar o valor de uma parcela inteira para amortizar?' },
    {
      type: 'p',
      text: 'Não há essa exigência matemática. Um aporte menor também reduz o principal. Confira com o banco os valores mínimos e procedimentos operacionais aplicáveis ao seu contrato.',
    },
    { type: 'h3', text: 'Posso interromper os aportes extras?' },
    {
      type: 'p',
      text: 'Se forem amortizações voluntárias, você pode rever o plano, mantendo integralmente os pagamentos obrigatórios. A meta projetada precisará ser recalculada. Se houver renegociação formal, valem os novos compromissos contratados.',
    },
    { type: 'h3', text: 'Paguei tudo. O processo termina no boleto?' },
    {
      type: 'p',
      text: 'Confirme a liquidação com o banco e obtenha o Termo de Quitação. Verifique os procedimentos e custos necessários para cancelar a garantia no registro do imóvel. Guarde os comprovantes e acompanhe eventuais débitos já agendados.',
    },
  ],
  sources: [
    {
      label: 'Código de Defesa do Consumidor: artigo 52, parágrafo 2º',
      href: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    },
    {
      label: 'Caixa: perguntas frequentes sobre amortização e liquidação do contrato imobiliário',
      href: 'https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-contrato/Paginas/default.aspx',
    },
    {
      label: 'Caixa e FGTS: condições de amortização, liquidação e pagamento de prestações',
      href: 'https://www.fgts.gov.br/Paginas/subpaginas/amortizacao_liquidacao.aspx',
    },
    {
      label: 'Banco Central: respostas oficiais sobre liquidação antecipada',
      href: 'https://www.bcb.gov.br/meubc/faqs/s/liquidacao-antecipada',
    },
  ],
};

export default artigo;
