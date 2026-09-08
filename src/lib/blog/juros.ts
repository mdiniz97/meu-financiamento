import type { Article } from './types';

const artigo: Article = {
  slug: 'juros-do-financiamento',
  title: 'Juros do financiamento: nominal, efetiva e CET na prática',
  description:
    'Aprenda a distinguir taxa nominal, efetiva, CET e correção monetária. Veja um exemplo de parcela e um roteiro para conferir a proposta do banco.',
  updatedAt: '2026-09-08',
  cta: { label: 'Simular meu financiamento', href: '/nova-simulacao' },
  blocks: [
    {
      type: 'p',
      text: 'Para entender os juros do financiamento, separe três perguntas: quanto custa o dinheiro emprestado, como o saldo é corrigido e quais despesas acompanham a operação. A taxa de juros responde apenas à primeira. O CET reúne custos previstos na contratação, mas não projeta a evolução futura de indexadores variáveis. Por isso, uma proposta aparentemente mais barata pode exigir mais cuidado do que sugere o número da propaganda.',
    },
    {
      type: 'p',
      text: 'O caminho seguro é comparar propostas para o mesmo valor financiado, prazo e sistema, identificar o indexador e conferir a composição do boleto. Neste guia, os números são exemplos educativos: não representam taxa disponível em um banco nem oferta de crédito aprovada para você.',
    },
    { type: 'h2', text: 'O que você paga em cada prestação' },
    {
      type: 'p',
      text: 'A amortização é a parte do pagamento que reduz o principal devido. Os juros remuneram o banco pelo saldo utilizado durante o período. No financiamento habitacional, o encargo mensal também pode incluir seguros e tarifas. A correção monetária, quando contratada, atualiza o saldo e influencia os cálculos seguintes; ela não deve ser confundida com a taxa de juros.',
    },
    {
      type: 'p',
      text: 'Um boleto de R$ 3 mil não significa que sua dívida caiu R$ 3 mil. Para conferir a redução, consulte o demonstrativo com saldo inicial, atualização, juros, amortização e saldo final. Isso evita a sensação de que o pagamento desapareceu: cada componente tem uma função diferente.',
    },
    { type: 'h2', text: 'Juros compostos não são juros pagos cobrados novamente' },
    {
      type: 'p',
      text: 'O regime composto estabelece a equivalência do dinheiro entre períodos. É a base da conversão entre taxas mensais e anuais e da fórmula de prestações fixas apresentada pela Calculadora do Cidadão do Banco Central. Isso não significa que todo financiamento em dia acumule juros vencidos sobre juros já pagos.',
    },
    {
      type: 'p',
      text: 'No modelo sem correção, se a prestação cobre os juros do mês, esses juros são liquidados e a diferença amortiza o principal. Não continuam dentro do saldo para ser cobrados de novo. Atraso, pagamento parcial ou renegociação podem produzir outra evolução, conforme o contrato. Também não é correto concluir que um contrato é legal ou ilegal apenas porque utiliza PRICE: uma análise jurídica exige examinar suas cláusulas e sua execução.',
    },
    {
      type: 'note',
      text: 'Um total de pagamentos elevado pode decorrer de muitos anos utilizando um saldo alto. Não é, por si só, prova de cobrança irregular nem de juros vencidos incorporados mensalmente.',
    },
    { type: 'h2', text: 'Taxa nominal e taxa efetiva: compare períodos equivalentes' },
    {
      type: 'p',
      text: 'Uma taxa nominal anual com capitalização mensal usa uma taxa periódica de referência. No exemplo de 12% nominais ao ano, a taxa mensal é 12% dividido por 12, ou 1%. A equivalente efetiva anual resulta de acumular esse fator por doze meses: (1 + 0,01)^12 - 1 = 12,6825%. A palavra nominal não significa automaticamente juros simples nem uma taxa falsa.',
    },
    {
      type: 'p',
      text: 'Se o contrato informa 12% efetivos ao ano, a conversão correta é outra: (1 + 0,12)^(1/12) - 1, aproximadamente 0,9489% ao mês. Dividir essa taxa anual por doze produziria uma taxa mensal diferente da equivalente. Antes de preencher um simulador, confira unidade e tipo no documento, não apenas o número.',
    },
    {
      type: 'table',
      caption: 'Duas taxas anuais de 12% que não têm o mesmo significado',
      headers: ['Informação contratual', 'Taxa mensal equivalente', 'Taxa efetiva anual'],
      rows: [
        ['12% nominal a.a., capitalização mensal', '1,0000% a.m.', '12,6825% a.a.'],
        ['12% efetiva a.a.', '0,9489% a.m.', '12,0000% a.a.'],
      ],
    },
    { type: 'h2', text: 'Exemplo: para onde vai a primeira prestação' },
    {
      type: 'p',
      text: 'Considere R$ 400 mil financiados no PRICE, em 360 pagamentos mensais, a 10,5% efetivos ao ano. A hipótese é sem TR, IPCA, seguros ou tarifas, com pagamentos em dia ao final de cada mês. A equivalente mensal é aproximadamente 0,835515568%. Usando a fórmula de prestação fixa, o pagamento financeiro fica em R$ 3.518,03.',
    },
    {
      type: 'table',
      caption: 'Primeiro mês do exemplo PRICE de R$ 400 mil',
      headers: ['Componente', 'Valor aproximado'],
      rows: [
        ['Saldo antes do pagamento', 'R$ 400.000,00'],
        ['Juros do primeiro mês', 'R$ 3.342,06'],
        ['Amortização do primeiro mês', 'R$ 175,97'],
        ['Prestação financeira', 'R$ 3.518,03'],
        ['Saldo após o pagamento', 'R$ 399.824,03'],
      ],
    },
    {
      type: 'p',
      text: 'O saldo cai pouco nesse início porque o prazo é longo e a maior parte da prestação corresponde aos juros sobre R$ 400 mil. Conforme o saldo diminui, os juros diminuem e a amortização cresce. As contas usam precisão integral; os valores exibidos foram arredondados para centavos.',
    },
    { type: 'h2', text: 'Prazo e sistema também mudam a conta' },
    {
      type: 'p',
      text: 'Mantendo as demais hipóteses, financiar os mesmos R$ 400 mil em 240 meses no PRICE exigiria cerca de R$ 3.867,03 mensais, com soma nominal de R$ 928.086,99. Em 360 meses, a soma seria R$ 1.266.490,52. O prazo menor exige mais caixa por mês, mas reduz o período sobre o qual os juros incidem.',
    },
    {
      type: 'p',
      text: 'O SAC distribui a amortização de outra forma e começa com uma prestação maior no exemplo equivalente. Essas comparações não são uma ordem para escolher sempre a parcela maior. Um orçamento sem folga pode gerar atraso ou dívida cara, anulando parte do planejamento. Compare custo, risco e capacidade de pagamento juntos.',
    },
    { type: 'h2', text: 'CET: mais completo que a taxa, mas não uma previsão' },
    {
      type: 'p',
      text: 'A Resolução CMN nº 4.881 define o CET a partir dos fluxos de liberação e pagamento, considerando juros, tarifas, tributos, seguros e outras despesas vinculadas. Ele é expresso como taxa percentual anual e deve vir acompanhado de demonstrativo antes da contratação. Não se calcula somando, por exemplo, 10% de juros a uma tarifa em reais.',
    },
    {
      type: 'p',
      text: 'O artigo 5º da norma determina que referenciais variáveis, como taxas flutuantes e índices de preços, não entrem no cálculo do CET; eles devem ser informados separadamente. Portanto, um CET menor em contrato com IPCA não prova que ele custará menos que outro com indexador diferente. A comparação precisa examinar o risco de atualização além dos encargos considerados no CET.',
    },
    { type: 'h2', text: 'Checklist para ler a proposta antes de assinar' },
    {
      type: 'ol',
      items: [
        'Identifique valor financiado, entrada, prazo, sistema e datas dos pagamentos.',
        'Anote taxa nominal e efetiva, suas unidades e eventuais condições para manter descontos.',
        'Confira se existe TR, IPCA ou outro referencial de atualização e quando ele é aplicado.',
        'Peça CET, demonstrativo de cálculo e discriminação de seguros, tarifas e despesas iniciais.',
        'Compare propostas equivalentes e simule cenários de correção e orçamento menos favoráveis.',
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Taxa efetiva já inclui seguro e cartório?' },
    {
      type: 'p',
      text: 'Não necessariamente. Efetiva descreve a equivalência da taxa em determinado período. Para encargos vinculados à operação, consulte o CET e seu demonstrativo; para o orçamento total da compra, também confira despesas não financiadas e não confundidas com juros.',
    },
    { type: 'h3', text: 'PRICE garante que o boleto nunca vai subir?' },
    {
      type: 'p',
      text: 'Não. Prestação constante é característica do modelo financeiro sob hipóteses estáveis. Correção contratual, seguros e outros componentes podem alterar o encargo pago. A cartilha habitacional da Caixa distingue justamente esses itens.',
    },
    { type: 'h3', text: 'A menor taxa na tabela do Banco Central vale para mim?' },
    {
      type: 'p',
      text: 'É uma referência de operações contratadas no período e na modalidade informados, não uma oferta individual. Cadastro, entrada, garantia e negociação alteram a proposta. Compare documentos do banco, não trate a média como aprovação ou piso obrigatório.',
    },
    { type: 'h2', text: 'Use a taxa certa no seu planejamento' },
    {
      type: 'p',
      text: 'No simulador, escolha o tipo de taxa indicado pelo banco e mantenha correção e seguro separados. A ferramenta transforma premissas em cenários; não substitui o contrato nem prevê o valor futuro da TR ou da inflação. Confira os resultados com o demonstrativo da instituição antes de assumir o compromisso.',
    },
    {
      type: 'links',
      items: [
        { label: 'Consultar juros de mercado e referências do Banco Central', href: '/juros' },
        { label: 'Entender a comparação entre SAC e PRICE', href: '/blog/sac-ou-price' },
        { label: 'Aprender a comparar propostas entre bancos', href: '/blog/qual-banco-financia-melhor' },
      ],
    },
  ],
  sources: [
    {
      label: 'Banco Central: metodologia do financiamento com prestações fixas',
      href: 'https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaFinanciamentoPrestacoesFixas.do?method=exibirMetodologiaFinanciamentoPrestacoesFixas',
    },
    {
      label: 'CMN: Resolução nº 4.881/2020, cálculo e divulgação do CET',
      href: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4881',
    },
    {
      label: 'Caixa: cartilha de indexadores e sistemas de amortização',
      href: 'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/passos_indexadores_amortizacao.pdf',
    },
    {
      label: 'Banco Central: taxas de juros e informações gerais',
      href: 'https://www.bcb.gov.br/estatisticas/txjuros?modalAberto=txjuros-modal-olho',
    },
  ],
};

export default artigo;
