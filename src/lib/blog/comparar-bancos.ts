import type { Article } from './types';

const artigo: Article = {
  slug: 'qual-banco-financia-melhor',
  title: 'Qual banco financia melhor? Como comparar taxas por instituição',
  description:
    'Use as médias do Banco Central como referência e compare propostas por CET, indexador, entrada, seguros e condições de relacionamento.',
  updatedAt: '2026-09-08',
  cta: {
    label: 'Ver taxas por instituição',
    href: '/juros',
  },
  blocks: [
    {
      type: 'p',
      text: 'O banco que financia melhor é aquele cuja proposta aprovada combina custo, risco e prestação compatíveis com seu orçamento. A menor média do Banco Central ajuda a selecionar instituições para consultar, mas não garante a menor taxa para você. Comece pelos dados oficiais e termine a comparação com propostas escritas, usando condições equivalentes e identificando o que pode mudar durante o contrato.',
    },
    { type: 'h2', text: 'Como ler as médias do Banco Central' },
    {
      type: 'p',
      text: 'O BACEN divulga médias das taxas das operações realizadas pelas instituições financeiras no período indicado. São médias aritméticas ponderadas pelos valores contratados: operações maiores têm mais peso no resultado. O indicador representa o custo efetivo médio dessas operações, com juros e custos adicionais, como encargos fiscais e operacionais.',
    },
    {
      type: 'p',
      text: 'Essa média não é piso de negociação, oferta disponível ou CET individual. Também não descreve necessariamente um cliente com sua renda e entrada. Uma taxa abaixo dela não prova vantagem suficiente; uma taxa acima não prova que o banco aceitará reduzi-la. Use o dado como referência para investigar, não como promessa.',
    },
    { type: 'h2', text: 'Escolha o recorte antes de comparar' },
    {
      type: 'p',
      text: 'Na consulta de financiamento imobiliário, confira o segmento de pessoa física, a modalidade, o indexador e o período. O portal separa taxas de mercado e reguladas, além de modalidades prefixadas e referenciadas em TR ou IPCA. Misturar essas categorias produz uma comparação que pode refletir regras e públicos distintos.',
    },
    {
      type: 'table',
      caption: 'Recortes que precisam acompanhar uma comparação por instituição',
      headers: ['Campo', 'O que conferir', 'Por que importa'],
      rows: [
        ['Modalidade', 'Mercado ou regulada', 'As condições e os públicos podem ser diferentes'],
        ['Indexador', 'Prefixado, TR ou IPCA', 'A atualização futura altera o risco'],
        ['Período', 'Mesma janela de referência', 'Contratações de épocas diferentes não são equivalentes'],
        ['Unidade', 'Taxa mensal ou anual', 'Percentuais de períodos diferentes não se comparam diretamente'],
      ],
    },
    {
      type: 'p',
      text: 'Registre a data e o recorte consultados. Não apresente o ranking como cotação em tempo real: ele retrata operações do período publicado, com informações prestadas pelas instituições.',
    },
    { type: 'h2', text: 'Entrada e perfil mudam a proposta' },
    {
      type: 'p',
      text: 'O percentual financiado em relação ao valor do imóvel considerado pelo banco é conhecido como LTV. Por exemplo, financiar R$ 400 mil sobre um imóvel avaliado em R$ 500 mil corresponde a 80%. Uma proposta com entrada maior não deve ser comparada à outra como se a única diferença fosse o banco.',
    },
    {
      type: 'p',
      text: 'Cadastro, renda, garantias e características da operação também influenciam a análise. Confirme qual valor do imóvel foi usado, pois avaliação e preço negociado podem diferir. Não aumente a entrada apenas para buscar desconto se isso deixar impostos, mudança e emergências sem cobertura.',
    },
    { type: 'h2', text: 'Taxa nominal, efetiva e CET não são iguais' },
    {
      type: 'p',
      text: 'A taxa nominal precisa ser lida com sua convenção e periodicidade de capitalização. A efetiva permite expressar a equivalência financeira no período. Compare taxas efetivas na mesma unidade; não coloque uma nominal anual de um banco ao lado de uma efetiva anual de outro como se fossem a mesma medida.',
    },
    {
      type: 'p',
      text: 'O CET consolida os encargos e despesas da operação em uma taxa anual, considerando valores e datas dos fluxos de pagamento. Inclui juros, tarifas, tributos, seguros e outras despesas vinculadas previstas na norma. Não se obtém somando percentuais de seguros e tarifas à taxa de juros. Solicite o demonstrativo com os componentes em reais antes de contratar.',
    },
    { type: 'h2', text: 'O que o CET não prevê sobre os indexadores' },
    {
      type: 'p',
      text: 'O artigo 5º da Resolução CMN nº 4.881 determina que referenciais de remuneração variáveis, como taxas flutuantes e índices de preços, não sejam considerados no cálculo do CET. Esses parâmetros devem ser informados no demonstrativo. Portanto, o CET apresentado não transforma um contrato indexado em custo futuro conhecido.',
    },
    {
      type: 'note',
      text: 'Um CET menor em uma linha atrelada ao IPCA não garante menor desembolso final que em uma linha com TR ou sem correção. Avalie separadamente o indexador contratado, sua forma de aplicação e o efeito de possíveis variações sobre o orçamento.',
    },
    { type: 'h2', text: 'Exemplo hipotético: duas taxas para R$ 300 mil' },
    {
      type: 'p',
      text: 'Imagine duas propostas fictícias de R$ 300 mil por 360 meses, ambas na PRICE, com taxas efetivas anuais constantes e primeira prestação após um mês. O exercício exclui TR, IPCA, seguros, tarifas, tributos e amortizações extras. Assim, isola o efeito da taxa sobre a prestação financeira, sem representar ofertas de instituições reais.',
    },
    {
      type: 'table',
      caption: 'Exemplo hipotético de R$ 300 mil na PRICE, sem custos adicionais',
      headers: ['Indicador', 'Proposta A', 'Proposta B'],
      rows: [
        ['Taxa efetiva anual', '11%', '9,5%'],
        ['Prazo', '360 meses', '360 meses'],
        ['Prestação financeira mensal', 'R$ 2.740,07', 'R$ 2.437,62'],
      ],
    },
    {
      type: 'p',
      text: 'A diferença aproximada é de R$ 302,46 por mês, calculada antes do arredondamento das prestações. Por isso, subtrair os valores exibidos pode gerar diferença de um centavo. Na contratação, seguros e demais condições podem alterar a vantagem: o exemplo não é uma promessa de economia obtida ao trocar de banco.',
    },
    { type: 'h2', text: 'Relacionamento e custos além dos juros' },
    {
      type: 'p',
      text: 'Pergunte se a taxa depende de receber salário, manter conta, aderir a débito automático ou contratar algum produto. Solicite as condições com e sem o desconto, incluindo o que acontece se você deixar de cumprir os requisitos. Um benefício que exige despesas recorrentes precisa ser avaliado pelo resultado financeiro completo.',
    },
    {
      type: 'p',
      text: 'Confira avaliação do imóvel, tarifas e seguros MIP e DFI. O MIP pode variar por saldo e faixa etária, conforme a apólice. Separe os custos do crédito, discriminados no CET, dos demais gastos da compra que exigem dinheiro disponível. Peça esclarecimentos sobre qualquer item não identificado no demonstrativo.',
    },
    { type: 'h2', text: 'Como negociar com propostas comparáveis' },
    {
      type: 'p',
      text: 'Envie o mesmo conjunto de informações a mais de uma instituição e peça simulações para igual valor financiado, prazo e sistema de amortização. Se alguma condição precisar mudar, anote a diferença. Uma prestação menor obtida com prazo maior não comprova crédito mais barato.',
    },
    {
      type: 'p',
      text: 'Leve a melhor proposta documentada aos demais bancos e pergunte o que conseguem oferecer. Confirme validade, necessidade de análise e despesas iniciais. Simulação é estimativa, não aprovação; escolha somente depois de conhecer as condições efetivamente oferecidas para você e para o imóvel.',
    },
    { type: 'h2', text: 'Checklist para escolher o banco' },
    {
      type: 'ol',
      items: [
        'Anote modalidade, indexador, período e unidade da média BACEN consultada.',
        'Mantenha entrada, LTV, prazo e sistema comparáveis nas propostas.',
        'Confira taxa efetiva, CET e demonstrativo dos custos em reais.',
        'Identifique referenciais variáveis e regras de atualização do saldo.',
        'Leia as condições de relacionamento e dos seguros ao longo do contrato.',
        'Preserve recursos para custos da compra e imprevistos.',
        'Guarde a proposta final e confirme sua validade antes de decidir.',
      ],
    },
    {
      type: 'links',
      items: [
        { label: 'Entenda as diferenças entre SAC e PRICE', href: '/blog/sac-ou-price' },
        { label: 'Leia o guia de juros e CET', href: '/blog/juros-do-financiamento' },
        { label: 'Avalie a portabilidade de um contrato existente', href: '/blog/portabilidade-de-financiamento' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Se o banco não aparece no ranking, ele não financia imóveis?' },
    {
      type: 'p',
      text: 'Não necessariamente. Segundo o BACEN, a ausência pode indicar falta de operações naquele recorte, informações não entregues no prazo ou instituição fora dos segmentos obrigados a reportar. Consulte diretamente o banco antes de concluir que o produto não existe.',
    },
    { type: 'h3', text: 'Uma taxa acima da média é automaticamente abusiva?' },
    {
      type: 'p',
      text: 'A média isolada não permite essa conclusão. Ela reúne operações com diferentes características e não estabelece teto ou piso para sua proposta. Peça a composição dos custos e esclarecimentos sobre as condições; uma avaliação jurídica exige examinar o caso concreto.',
    },
    { type: 'h3', text: 'Posso usar a média para decidir uma portabilidade?' },
    {
      type: 'p',
      text: 'Ela ajuda a identificar instituições para consultar, mas a decisão depende da proposta de portabilidade. Compare o saldo e o prazo restantes, os encargos atuais, os novos custos e o indexador. Não aplique automaticamente ao seu contrato a economia do exemplo hipotético.',
    },
  ],
  sources: [
    {
      label: 'Banco Central: taxas de juros e informações gerais sobre as médias por instituição',
      href: 'https://www.bcb.gov.br/estatisticas/txjuros?modalAberto=txjuros-modal-olho',
    },
    {
      label: 'CMN: Resolução nº 4.881, cálculo do CET e exclusão de referenciais variáveis no artigo 5º',
      href: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4881',
    },
    {
      label: 'CAIXA: perguntas frequentes sobre taxas, seguros e novos financiamentos',
      href: 'https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx',
    },
    {
      label: 'CAIXA: Cartilha Crédito Imobiliário, simulação e planejamento financeiro',
      href: 'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/passos_indexadores_amortizacao.pdf',
    },
  ],
};

export default artigo;
