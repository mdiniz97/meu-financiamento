import type { Article } from './types';

const artigo: Article = {
  slug: 'tr-saldo-devedor-cresce',
  title: 'TR no financiamento: por que o saldo devedor pode crescer',
  description:
    'Entenda o que é a TR, como ela entra no cálculo do financiamento imobiliário e por que, em alguns casos, o saldo devedor aumenta nos primeiros meses.',
  updatedAt: '2026-10-07',
  cta: { label: 'Simular meu financiamento', href: '/nova-simulacao' },
  blocks: [
    {
      type: 'p',
      text: 'Quem acompanha o financiamento imobiliário já ouviu falar que o saldo devedor "aumenta em vez de diminuir". Isso acontece em contratos corrigidos por um indexador, e a TR é um deles. Entender como a TR entra na conta evita susto com o extrato e ajuda a planejar a amortização.',
    },
    { type: 'h2', text: 'O que é a TR' },
    {
      type: 'p',
      text: 'A TR, Taxa Referencial, é um indexador calculado a partir das taxas de juros praticadas no mercado e divulgado pelo Banco Central. Em muitos períodos ela fica próxima de zero, mas pode ficar positiva. Quando o contrato prevê correção pela TR, esse índice é aplicado periodicamente ao saldo devedor.',
    },
    {
      type: 'p',
      text: 'A TR não é a taxa de juros do seu financiamento. Ela é uma correção monetária sobre o saldo, somada aos juros contratuais. Confundir as duas leva a conclusões erradas sobre o custo real do contrato.',
    },
    { type: 'h2', text: 'Como a TR entra no cálculo' },
    {
      type: 'p',
      text: 'A cada período, o saldo devedor é corrigido pela TR e depois recebe os juros. Da prestação, você paga primeiro juros e encargos e, o que sobra, amortiza o principal. Quando a correção mais os juros são maiores que a amortização daquele mês, o saldo pode terminar maior do que começou.',
    },
    {
      type: 'p',
      text: 'Em contratos com TR zero, isso não ocorre: o saldo só cai. O problema aparece quando a TR é positiva e a amortização mensal ainda é pequena, o que é típico do início de um contrato PRICE, em que quase toda a prestação é juro.',
    },
    { type: 'h2', text: 'Um exemplo hipotético' },
    {
      type: 'p',
      text: 'Considere um saldo de R$ 400.000,00, prestação PRICE de R$ 3.518,03, juros de 10,5% ao ano e TR de 0,15% ao mês, apenas para ilustrar. No exemplo, a correção mensal sobre o saldo é de R$ 600,00 e os juros somam cerca de R$ 3.342,00, enquanto a amortização inicial fica perto de R$ 176,00.',
    },
    {
      type: 'table',
      caption: 'Ilustração com TR de 0,15% ao mês no primeiro mês',
      headers: ['Componente', 'Valor aproximado'],
      rows: [
        ['Prestação', 'R$ 3.518,03'],
        ['Juros do mês', 'R$ 3.342,06'],
        ['Correção pela TR', 'R$ 600,00'],
        ['Amortização embutida', 'R$ 176,00'],
      ],
    },
    {
      type: 'p',
      text: 'Nesse cenário, a soma de juros e correção supera a amortização do mês e o saldo tende a crescer no início. Com o tempo, a amortização aumenta e passa a superar a correção, e o saldo volta a cair. Isso não é erro do banco quando o contrato prevê o indexador: é consequência matemática do sistema escolhido.',
    },
    {
      type: 'note',
      text: 'A TR varia ao longo do tempo e este é um exemplo hipotético de didática, não uma previsão nem a TR vigente. Consulte a página de juros de mercado do amortiza.me, que mostra dados oficiais do Banco Central, e confira no seu contrato qual indexador é aplicado.',
    },
    { type: 'h2', text: 'SAC e PRICE reagem diferente' },
    {
      type: 'p',
      text: 'No PRICE, a amortização começa pequena e cresce a cada mês, então é onde o saldo mais tende a subir quando a TR é positiva. No SAC, a amortização é praticamente constante desde o início e a parcela começa maior, o que torna o crescimento do saldo bem menos provável nas mesmas condições.',
    },
    {
      type: 'p',
      text: 'Nos dois sistemas, uma amortização extraordinária reduz o principal e enfraquece o efeito da correção, porque o saldo que sofre a TR fica menor. Aportes nos primeiros meses costumam ter o maior impacto justamente por atacarem a fase em que o saldo teima em não cair.',
    },
    { type: 'h2', text: 'O que fazer' },
    {
      type: 'ul',
      items: [
        'Confira no contrato se há indexador (TR, IPCA ou outro) e qual a periodicidade de correção.',
        'Peça ao banco o demonstrativo atualizado, com saldo, taxa, encargos e prazo restante.',
        'Simule o efeito de aportes extras no seu sistema antes de assumir que o saldo nunca cairá.',
        'Não misture a correção com a taxa de juros ao comparar propostas de bancos diferentes.',
      ],
    },
    {
      type: 'links',
      items: [
        { label: 'Consultar TR, Selic e taxas de mercado', href: '/juros' },
        { label: 'Entender as diferenças entre SAC e PRICE', href: '/blog/sac-ou-price' },
        { label: 'Planejar aportes para quitar antes', href: '/blog/quitar-financiamento-antes' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'A TR é sempre positiva?' },
    {
      type: 'p',
      text: 'Não. Em vários períodos ela ficou em zero. Quando o contrato prevê TR e ela está zerada, o saldo não sofre correção e tende a cair normalmente.',
    },
    { type: 'h3', text: 'Todo financiamento imobiliário tem TR?' },
    {
      type: 'p',
      text: 'Não. Existem contratos corrigidos por TR, por IPCA, ou com taxa pré-fixada sem indexador. Isso varia com o produto e o banco.',
    },
    { type: 'h3', text: 'Preciso me preocupar se o saldo subiu?' },
    {
      type: 'p',
      text: 'Vale entender o motivo. Se o contrato prevê correção e a amortização inicial é pequena, é esperado. Amortizações extras e, em alguns casos, a troca para um sistema com amortização constante ajudam a virar o jogo.',
    },
  ],
  sources: [
    {
      label: 'Banco Central: séries de TR, Selic e índices',
      href: 'https://www.bcb.gov.br/',
    },
    {
      label: 'Banco Central: perguntas frequentes sobre crédito imobiliário',
      href: 'https://www.bcb.gov.br/meubc/faqs/',
    },
    {
      label: 'Caixa: condições do financiamento imobiliário',
      href: 'https://www.caixa.gov.br/voce/habitacao/Paginas/default.aspx',
    },
  ],
};

export default artigo;
