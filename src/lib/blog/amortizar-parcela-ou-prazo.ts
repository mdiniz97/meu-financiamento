import type { Article } from './types';

const artigo: Article = {
  slug: 'amortizar-reduzir-parcela-ou-prazo',
  title: 'Amortizar o financiamento: reduzir a parcela ou o prazo?',
  description:
    'Entenda a diferença entre reduzir a parcela e reduzir o prazo ao amortizar, veja um exemplo PRICE com aporte único e saiba quando escolher cada opção.',
  updatedAt: '2026-10-07',
  cta: { label: 'Calcular meu aporte para quitar antes', href: '/meta-de-quitacao' },
  blocks: [
    {
      type: 'p',
      text: 'Ao amortizar o financiamento, o banco costuma oferecer duas escolhas: reduzir o valor da parcela, mantendo o prazo, ou reduzir o prazo, mantendo a parcela. As duas baixam a dívida, mas mudam o resultado ao longo dos anos. A melhor opção depende do seu objetivo: aliviar o orçamento agora ou pagar menos juros no total.',
    },
    {
      type: 'p',
      text: 'Esta escolha é feita no momento da amortização e precisa constar na solicitação. Pagar o boleto comum antes do vencimento não é a mesma coisa que pedir amortização extraordinária do principal.',
    },
    { type: 'h2', text: 'O que cada opção muda' },
    {
      type: 'table',
      caption: 'As duas formas de usar uma amortização extraordinária',
      headers: ['Opção', 'O que acontece', 'Objetivo principal'],
      rows: [
        ['Reduzir a parcela', 'A prestação cai e o prazo segue o mesmo', 'Aliviar o compromisso mensal'],
        ['Reduzir o prazo', 'Encurta o contrato; o banco recalcula o cronograma', 'Antecipar a quitação e reduzir juros futuros'],
      ],
    },
    {
      type: 'p',
      text: 'No modelo PRICE sem indexador, reduzir prazo pode manter o pagamento de principal e juros enquanto diminui o número de meses. No SAC, ou com TR, seguros e tarifas, o boleto não precisa permanecer igual. Compare os novos cronogramas emitidos pelo banco para o mesmo aporte e a mesma data; não apenas o valor da próxima parcela.',
    },
    { type: 'h2', text: 'Exemplo PRICE com um aporte único' },
    {
      type: 'p',
      text: 'Exemplo didático recalculado nesta revisão: saldo inicial de R$ 400.000,00, 360 meses e taxa escolhida de 10,5% efetivos ao ano. Não é taxa ofertada atualmente por um banco. Após pagar a 12ª prestação, o saldo é R$ 397.788,61. Um aporte de R$ 30.000,00 reduz esse saldo para R$ 367.788,61. A comparação considera apenas juros futuros, a partir desse momento.',
    },
    {
      type: 'ul',
      items: [
        'Taxa mensal equivalente de aproximadamente 0,835515568% e prestação-base de R$ 3.518,03.',
        'Pagamentos ao final de cada mês, sem TR, IPCA, seguros, tarifas ou renegociação.',
        'Sem aportes recorrentes, sem FGTS e sem décimo terceiro: apenas o aporte único citado.',
      ],
    },
    {
      type: 'table',
      caption: 'Efeito de R$ 30.000,00 amortizados no mês 12 (PRICE)',
      headers: ['Cenário', 'Prestação depois do aporte', 'Meses restantes', 'Juros futuros'],
      rows: [
        ['Sem aporte', 'R$ 3.518,03', '348', 'R$ 826.485,56'],
        ['Reduzir o prazo', 'R$ 3.518,03; última de R$ 1.648,89', '249', 'R$ 506.331,53'],
        ['Reduzir a parcela', 'R$ 3.252,71', '348', 'R$ 764.154,55'],
      ],
    },
    {
      type: 'p',
      text: 'No mesmo saldo, reduzir o prazo encurta o contrato em cerca de 8 anos e corta aproximadamente R$ 320.000,00 de juros futuros. Reduzir a parcela baixa a prestação em cerca de R$ 265,00 por mês e economiza perto de R$ 62.000,00 de juros. Os valores são arredondados e servem para comparar as duas escolhas, não como promessa de contrato.',
    },
    {
      type: 'note',
      text: 'A economia é uma soma nominal distribuída por décadas. Não é dinheiro devolvido nem desconto à vista. O cálculo não traz os fluxos a valor presente e depende das premissas. Confirme saldo, taxa e cronograma com o banco antes de decidir.',
    },
    { type: 'h2', text: 'Quando cada opção faz mais sentido' },
    {
      type: 'p',
      text: 'Reduzir prazo costuma atender quem tem folga estável e quer encerrar a dívida antes. Reduzir prestação pode diminuir o compromisso obrigatório e o risco de aperto no orçamento. Se você reduzir a prestação e reaplicar toda a folga em novos aportes, compare esse fluxo explicitamente: no mesmo modelo e com os mesmos desembolsos e datas, o saldo segue a mesma trajetória. A diferença prática está no compromisso obrigatório e na disciplina para reaportar.',
    },
    {
      type: 'p',
      text: 'A decisão não precisa ser definitiva para todo o contrato. Você pode reduzir a parcela agora, em uma fase de renda menor, e voltar a priorizar o prazo depois, quando o caixa melhorar. Reavalie sempre que a renda ou as despesas mudarem bastante.',
    },
    { type: 'h2', text: 'Cuidados antes de amortizar' },
    {
      type: 'ul',
      items: [
        'Mantenha uma reserva de emergência: a amortização não é reversível, enquanto o dinheiro guardado continua disponível.',
        'Compare com o rendimento líquido de investimentos de risco e prazo parecidos, considerando impostos e liquidez.',
        'Solicite por escrito o abatimento do principal e confirme qual opção foi aplicada antes de pagar o valor extra.',
        'Continue pagando o boleto obrigatório normalmente; o aporte extra não substitui a prestação devida.',
        'O FGTS segue regras próprias de uso habitacional e depende do enquadramento do contrato, do imóvel e do titular.',
      ],
    },
    { type: 'h2', text: 'Como simular a sua meta' },
    {
      type: 'p',
      text: 'Use a meta de quitação do amortiza.me para estimar o esforço mensal de antecipar o fim do contrato, com acesso conforme o plano. Para escolher entre prazo e prestação, peça também ao banco duas simulações do mesmo aporte na mesma data. Confira novo saldo, boletos, prazo, indexador e juros futuros; a calculadora não substitui o cronograma contratual.',
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
    { type: 'h3', text: 'Preciso amortizar o valor de uma parcela inteira?' },
    {
      type: 'p',
      text: 'Não há essa exigência matemática: qualquer valor destinado ao principal reduz a dívida. Confirme com o banco eventuais valores mínimos e procedimentos operacionais do seu contrato.',
    },
    { type: 'h3', text: 'Posso mudar de opção depois?' },
    {
      type: 'p',
      text: 'Cada nova amortização é uma decisão nova. Você pode reduzir a parcela em um momento e reduzir o prazo em outro, desde que solicite a opção desejada em cada aporte.',
    },
    { type: 'h3', text: 'Reduzir a parcela também economiza juros?' },
    {
      type: 'p',
      text: 'Sim, porque o saldo cai e os juros passam a incidir sobre uma base menor. A economia é apenas menor do que manter a prestação alta, porque a dívida demora mais para ser quitada.',
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
      label: 'Banco Central: respostas oficiais sobre liquidação antecipada',
      href: 'https://www.bcb.gov.br/meubc/faqs/s/liquidacao-antecipada',
    },
  ],
};

export default artigo;
