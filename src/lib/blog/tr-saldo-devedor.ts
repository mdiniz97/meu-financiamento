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
      text: 'A TR, Taxa Referencial, é calculada e divulgada pelo Banco Central segundo metodologia própria. Não é a Selic nem um índice de inflação como o IPCA. Quando o financiamento prevê TR, a correção segue o índice, a data de referência e a periodicidade previstos no contrato; não existe uma TR mensal fixa para todos os próximos anos.',
    },
    {
      type: 'p',
      text: 'A TR não é a taxa de juros do seu financiamento. Ela é uma correção monetária sobre o saldo, somada aos juros contratuais. Confundir as duas leva a conclusões erradas sobre o custo real do contrato.',
    },
    { type: 'h2', text: 'Como a TR entra no cálculo' },
    {
      type: 'p',
      text: 'Para conferir o extrato, separe quatro valores: saldo anterior, correção monetária, juros e amortização. Em um modelo que corrige o saldo antes de calcular juros, o saldo final é o saldo anterior mais a correção, menos a amortização. Juros pagos no boleto não devem ser somados novamente nessa comparação: o saldo cresce quando a correção supera o principal amortizado.',
    },
    {
      type: 'p',
      text: 'Com TR zero, pagamentos em dia e amortização positiva, o saldo diminui. Atrasos, encargos incorporados e outras regras podem mudar esse resultado. TR positiva, por sua vez, não garante crescimento da dívida: é preciso conferir quanto o contrato amortizou e se a prestação ou a base de cálculo também foram atualizadas.',
    },
    { type: 'h2', text: 'Um exemplo hipotético' },
    {
      type: 'p',
      text: 'Exemplo calculado, não cotação atual: saldo de R$ 400.000,00, juros de 10,5% efetivos ao ano (0,835515568% ao mês) e correção hipotética de 0,15% no período. Para isolar o efeito, mantemos o pagamento de principal e juros em R$ 3.518,03, sem reajustá-lo e sem seguros ou tarifas. A correção entra antes dos juros. Essa hipótese não representa automaticamente o recálculo de um contrato bancário.',
    },
    {
      type: 'table',
      caption: 'Um período com correção hipotética de 0,15% e pagamento mantido fixo',
      headers: ['Componente', 'Valor aproximado'],
      rows: [
        ['Saldo anterior', 'R$ 400.000,00'],
        ['Correção monetária', 'R$ 600,00'],
        ['Saldo corrigido', 'R$ 400.600,00'],
        ['Juros sobre o saldo corrigido', 'R$ 3.347,08'],
        ['Pagamento de principal e juros', 'R$ 3.518,03'],
        ['Principal amortizado', 'R$ 170,95'],
        ['Saldo depois do pagamento', 'R$ 400.429,05'],
      ],
    },
    {
      type: 'p',
      text: 'Neste modelo, a correção de R$ 600,00 supera a amortização de R$ 170,95, aumentando o saldo em R$ 429,05. Se o banco atualizar também a prestação ou a amortização, o resultado será diferente. O nome PRICE e a presença de TR, sozinhos, não provam que o saldo crescerá nem que o extrato está correto.',
    },
    {
      type: 'note',
      text: 'A TR varia ao longo do tempo e este é um exemplo hipotético de didática, não uma previsão nem a TR vigente. Consulte a página de juros de mercado do amortiza.me, que mostra dados oficiais do Banco Central, e confira no seu contrato qual indexador é aplicado.',
    },
    { type: 'h2', text: 'SAC e PRICE reagem diferente' },
    {
      type: 'p',
      text: 'Sem indexador, a PRICE mantém o pagamento de principal e juros constante e começa amortizando menos; o SAC amortiza uma quantidade constante e começa com parcela maior. Em contratos indexados, essas bases podem ser corrigidas. Por isso, não prometa parcela fixa em reais nem amortização invariável: confira como o banco aplica o indexador em cada sistema.',
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
      text: 'Peça a memória de cálculo e reconcilie saldo anterior, correção e amortização. Confira também atrasos e encargos incorporados. Aporte extra pode reduzir o saldo, mas trocar de sistema depende de proposta e aprovação do banco: não é uma alteração automática do contrato.',
    },
  ],
  sources: [
    {
      label: 'Banco Central: Sistema Gerenciador de Séries Temporais (consulta da TR)',
      href: 'https://www3.bcb.gov.br/sgspub/',
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
