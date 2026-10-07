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
      text: 'Definida a parcela máxima, reserve primeiro a parte destinada a seguros e tarifas. A tabela abaixo é um exemplo matemático com 30% da renda para principal e juros, 360 meses e taxa hipotética de 10,5% efetivos ao ano. Não inclui TR, seguros nem tarifas e não representa aprovação ou taxa atual de mercado. A taxa mensal equivalente é 0,835515568%.',
    },
    {
      type: 'table',
      caption: 'Exemplo sem encargos: 360 meses e juros de 10,5% efetivos ao ano',
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
      text: 'Não existe entrada universal de 20%. A cota depende da linha, do sistema, da região e de o imóvel ser novo ou usado. Como referência atual, o Ministério das Cidades informa, para a Faixa 4 (Classe Média) do MCMV, máximo de 60% em usados no Sul e Sudeste; nos demais casos descritos nessa linha, até 80% em PRICE e 90% em SAC. São limites máximos: a política do banco e a análise de renda podem financiar menos.',
    },
    {
      type: 'p',
      text: 'Além da entrada, reserve ITBI, registro e avaliação, conforme operação e município. Não some automaticamente escritura pública em separado: contratos de financiamento podem ter força de escritura pública. Benefícios, descontos e despesas financiáveis precisam ser confirmados com o banco e o cartório.',
    },
    {
      type: 'p',
      text: 'O financiamento aprovado é limitado pelo menor valor entre capacidade de pagamento e cota da operação, respeitando também tetos da linha e avaliação do imóvel. Se sua renda sustenta R$ 270 mil, mas a cota permite apenas R$ 240 mil, você precisa cobrir a diferença com recursos elegíveis. Uma avaliação abaixo do preço negociado também pode aumentar a entrada.',
    },
    { type: 'h2', text: 'Quanto seguros e taxa mudam o resultado?' },
    {
      type: 'p',
      text: 'Com renda de R$ 8.000,00 e limite de R$ 2.400,00 para o boleto, suponha R$ 250,00 de seguros e tarifas mensais. Sobram R$ 2.150,00 para principal e juros. No mesmo exemplo PRICE da tabela, o valor calculado cai de R$ 272.880,05 para R$ 244.455,05. Os R$ 250,00 são uma hipótese, não cotação de seguro: MIP, DFI e tarifas dependem da proposta e podem variar.',
    },
    { type: 'h2', text: 'Não use uma taxa única para todos os perfis' },
    {
      type: 'table',
      caption: 'Sensibilidade matemática: R$ 2.400,00 para principal e juros, PRICE em 360 meses',
      headers: ['Taxa efetiva anual hipotética', 'Principal calculado'],
      rows: [
        ['8,0%', 'R$ 335.947,20'],
        ['10,5%', 'R$ 272.880,05'],
        ['13,0%', 'R$ 228.453,59'],
      ],
    },
    {
      type: 'p',
      text: 'Essas taxas são cenários, não ofertas atuais. Consulte referências do Banco Central em Juros de mercado e use a proposta do seu perfil para decidir. No MCMV, renda e enquadramento também mudam taxas e subsídios: em outubro de 2026, a linha financiada oficial atende renda até R$ 13 mil, com tetos de imóvel diferentes por faixa. Taxa nominal, taxa efetiva e CET não são intercambiáveis.',
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
        { label: 'Conferir faixas e condições atuais do MCMV', href: '/blog/minha-casa-minha-vida' },
        { label: 'Consultar referências de juros do Banco Central', href: '/juros' },
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
      label: 'Ministério das Cidades: Faixa 4 (Classe Média) e cotas por sistema, região e tipo de imóvel (consulta em 07/10/2026)',
      href: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/minha-casa-minha-vida-classe-media/minha-casa-minha-vida-classe-media-1',
    },
    {
      label: 'Caixa: condições e regras do crédito imobiliário',
      href: 'https://www.caixa.gov.br/voce/habitacao/Paginas/default.aspx',
    },
  ],
};

export default artigo;
