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
        ['Reduzir o prazo', 'A prestação se mantém e o contrato termina antes', 'Pagar menos juros no total'],
      ],
    },
    {
      type: 'p',
      text: 'Quando você reduz o prazo, cada mês seguinte carrega a mesma parcela sobre um saldo menor, então a dívida anda mais rápido. Quando você reduz a parcela, o alívio é imediato no orçamento, mas o saldo cai em ritmo mais lento e os juros futuros somam mais. Manter a parcela alta tende a economizar mais juros; reduzir a parcela tende a dar mais fôlego no caixa.',
    },
    { type: 'h2', text: 'Exemplo PRICE com um aporte único' },
    {
      type: 'p',
      text: 'Este exemplo usa o sistema PRICE, com saldo devedor de R$ 400.000,00, 360 meses restantes e juros de 10,5% efetivos ao ano. Supõe um único aporte de R$ 30.000,00 no mês 12, destinado ao principal, e compara cada opção com o cenário sem aporte.',
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
        ['Reduzir o prazo', 'R$ 3.518,03', 'cerca de 249', 'R$ 506.331,53'],
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
      text: 'Reduzir o prazo combina com quem tem folga mensal estável e quer minimizar o total pago. Reduzir a parcela combina com quem precisa de alívio imediato no orçamento ou quer liberar caixa para outros objetivos. Se a ideia é usar a folga para novos aportes, reduza o prazo e mantenha o plano de amortizações regulares, em vez de baixar a parcela e gastar a diferença.',
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
      text: 'Na ferramenta de meta de quitação do amortiza.me, informe saldo, taxa e prazo reais e compare os dois caminhos, ajustando o aporte ao que cabe no orçamento. Trate o resultado como estimativa conforme as premissas exibidas e confirme o plano com o seu banco.',
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
