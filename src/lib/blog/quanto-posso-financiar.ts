import type { Article } from './types';

const artigo: Article = {
  slug: 'quanto-posso-financiar',
  title: 'Quanto posso financiar com a minha renda?',
  description:
    'Veja como os bancos usam o comprometimento da renda para definir a parcela máxima, estime o valor financiável por faixa de renda e entenda o peso da entrada e dos custos.',
  updatedAt: '2026-10-07',
  cta: { label: 'Descobrir qual imóvel cabe no meu bolso', href: '/qual-imovel-cabe-no-meu-bolso' },
  blocks: [
    {
      type: 'p',
      text: 'O valor que você consegue financiar não depende só do preço do imóvel: depende da sua capacidade de pagar a prestação todo mês. Os bancos partem da renda, aplicam um limite de comprometimento e calculam qual saldo devedor aquela parcela sustenta. Entender essa conta ajuda a chegar na negociação com um alvo realista.',
    },
    { type: 'h2', text: 'O que os bancos olham' },
    {
      type: 'p',
      text: 'O critério mais comum é limitar a prestação a cerca de 30% da renda bruta familiar. Além disso, o banco avalia a estabilidade da renda, o histórico de crédito, a idade e o prazo máximo, e a sua capacidade de comprovar renda formal. Rendas variáveis costumam ser consideradas com cautela ou por média.',
    },
    {
      type: 'ul',
      items: [
        'Comprometimento usual: prestação de até aproximadamente 30% da renda bruta.',
        'A prestação considerada costuma ser a inicial, que é a maior no SAC e inclui seguros e taxa de administração.',
        'Prazo longo reduz a parcela, mas aumenta o total de juros pagos.',
        'A entrada e os custos de compra correm por fora do financiamento.',
      ],
    },
    { type: 'h2', text: 'Da parcela para o valor financiado' },
    {
      type: 'p',
      text: 'Definida a parcela máxima, o valor financiável sai da mesma fórmula que calcula a prestação. A tabela abaixo usa parcela de 30% da renda, prazo de 360 meses e juros de 10,5% efetivos ao ano, e mostra quanto essa parcela sustenta em cada sistema.',
    },
    {
      type: 'table',
      caption: 'Valor financiável com parcela de 30% da renda (360 meses, 10,5% ao ano)',
      headers: ['Renda bruta mensal', 'Parcela máxima (30%)', 'Financiável no PRICE', 'Financiável no SAC'],
      rows: [
        ['R$ 5.000,00', 'R$ 1.500,00', 'R$ 170.550,03', 'R$ 134.735,38'],
        ['R$ 8.000,00', 'R$ 2.400,00', 'R$ 272.880,05', 'R$ 215.576,61'],
        ['R$ 12.000,00', 'R$ 3.600,00', 'R$ 409.320,08', 'R$ 323.364,91'],
      ],
    },
    {
      type: 'p',
      text: 'A diferença entre PRICE e SAC chama atenção: com a mesma parcela inicial, o PRICE financia bem mais. Isso acontece porque no SAC a parcela começa maior e cai depois, enquanto no PRICE ela é constante. Como o banco olha a prestação inicial, o SAC exige uma renda maior para o mesmo valor financiado.',
    },
    {
      type: 'note',
      text: 'Os valores são estimativas conforme as premissas e arredondamentos exibidos. Bancos aplicam taxas, seguros, tarifas e critérios próprios, e podem considerar a prestação inicial com encargos. Use a tabela para ter ordem de grandeza, não como teto garantido.',
    },
    { type: 'h2', text: 'Entrada e custos da compra' },
    {
      type: 'p',
      text: 'Na maioria dos financiamentos, o banco financia até 80% do valor do imóvel, então a entrada corresponde a pelo menos 20%. Some a isso os custos de fechamento, como ITBI, escritura e registro, e eventuais despesas de avaliação. Esses valores saem do bolso e não entram no saldo financiado.',
    },
    {
      type: 'p',
      text: 'Ou seja: com uma renda que sustenta R$ 270.000,00 de financiamento, o imóvel acessível pode ser maior, desde que você tenha a entrada e os custos em mãos. É essa conta completa, e não só a prestação, que define o imóvel que cabe no orçamento.',
    },
    { type: 'h2', text: 'O que aumenta ou reduz o valor' },
    {
      type: 'ul',
      items: [
        'Aumentam o valor: renda maior ou mais de um titular, entrada maior, taxa menor, prazo mais longo e bom histórico de crédito.',
        'Reduzem o valor: endividamento já existente, renda variável ou sem comprovação, prestação inicial do SAC e prazos curtos.',
        'Seguros (MIP e DFI) e taxa de administração entram na prestação e consomem parte do limite de comprometimento.',
      ],
    },
    { type: 'h2', text: 'Como estimar o seu caso' },
    {
      type: 'p',
      text: 'Na ferramenta do amortiza.me você informa a renda e vê quanto ela sustenta de financiamento e qual faixa de imóvel fica dentro do orçamento. Ajuste taxa, prazo e sistema para comparar cenários antes de falar com o banco.',
    },
    {
      type: 'links',
      items: [
        { label: 'Descobrir qual imóvel cabe no meu bolso', href: '/qual-imovel-cabe-no-meu-bolso' },
        { label: 'Entender as diferenças entre SAC e PRICE', href: '/blog/sac-ou-price' },
        { label: 'Estimar os custos da compra', href: '/blog/quanto-preciso-para-comprar' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'O limite de 30% é obrigatório?' },
    {
      type: 'p',
      text: 'É uma referência bastante usada, não uma regra única. Cada banco define a sua política e pode aceitar comprometimento um pouco maior ou menor conforme renda, garantia e histórico.',
    },
    { type: 'h3', text: 'Renda informal entra na conta?' },
    {
      type: 'p',
      text: 'Pode ser considerada, mas costuma exigir comprovação por extratos, declaração de imposto ou movimentação. A comprovação influencia a taxa e o valor aprovado.',
    },
    { type: 'h3', text: 'Vale mais pegar o maior prazo para financiar mais?' },
    {
      type: 'p',
      text: 'Prazo maior eleva o valor aprovado e reduz a parcela, mas aumenta o total de juros. Financie o que precisa e mantenha folga no orçamento para amortizar quando sobrar.',
    },
  ],
  sources: [
    {
      label: 'Banco Central: perguntas frequentes sobre crédito imobiliário',
      href: 'https://www.bcb.gov.br/meubc/faqs/',
    },
    {
      label: 'Caixa: condições e regras do crédito imobiliário',
      href: 'https://www.caixa.gov.br/voce/habitacao/Paginas/default.aspx',
    },
  ],
};

export default artigo;
