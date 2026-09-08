import type { Article } from './types';

const artigo: Article = {
  slug: 'sac-ou-price',
  title: 'SAC vs PRICE: qual sistema de amortização é melhor para você?',
  description:
    'Compare SAC e PRICE com um exemplo de R$ 400 mil, entenda a variação dos boletos e escolha considerando orçamento, juros e amortizações extras.',
  updatedAt: '2026-09-08',
  cta: {
    label: 'Comparar SAC e PRICE no simulador',
    href: '/nova-simulacao',
  },
  blocks: [
    {
      type: 'p',
      text: 'O SAC tende a cobrar menos juros que a PRICE quando valor financiado, taxa e prazo são iguais, mas exige uma prestação inicial maior. A PRICE distribui o pagamento de outra forma e pode facilitar o orçamento no início. Nenhum sistema é melhor para todos: a escolha depende das propostas disponíveis, da sua capacidade de pagamento e dos planos para amortizar a dívida.',
    },
    { type: 'h2', text: 'O que muda entre juros e amortização' },
    {
      type: 'p',
      text: 'Amortização é a parte do pagamento que reduz o principal da dívida. Juros remuneram o dinheiro emprestado durante o período. O sistema de amortização organiza essas duas parcelas ao longo do contrato; ele não define sozinho a taxa oferecida pelo banco, os seguros ou o indexador.',
    },
    {
      type: 'p',
      text: 'Na comparação controlada, usamos a mesma taxa para enxergar apenas o efeito do sistema. Nas propostas comerciais, SAC e PRICE podem ter taxas, limites de financiamento e condições diferentes. Por isso, primeiro entenda a mecânica; depois compare as propostas reais, sem assumir que o banco oferecerá condições idênticas.',
    },
    { type: 'h2', text: 'PRICE: parcela constante no modelo sem correção' },
    {
      type: 'p',
      text: 'Na PRICE, também chamada de Sistema Francês de Amortização, a prestação financeira permanece constante no modelo com taxa fixa e sem atualização monetária. No começo, o saldo devedor é maior, então os juros ocupam uma parcela maior do pagamento. Conforme o saldo diminui, os juros caem e a amortização cresce.',
    },
    {
      type: 'p',
      text: 'Isso não significa que juros já pagos sejam incorporados novamente à dívida. No fluxo regular, com a prestação cobrindo os juros do período, eles são quitados e o restante amortiza o saldo. A dívida cai mais devagar porque a amortização inicial é menor, não porque o banco trata os juros pagos como inadimplidos.',
    },
    { type: 'h2', text: 'SAC: parcela que começa alta e tende a cair' },
    {
      type: 'p',
      text: 'No Sistema de Amortização Constante, o principal é dividido em amortizações iguais no modelo sem correção. Os juros incidem sobre um saldo progressivamente menor, fazendo a prestação financeira diminuir. Para o mesmo valor, taxa e prazo, a amortização inicial supera a da PRICE e o saldo cai mais rapidamente.',
    },
    {
      type: 'p',
      text: 'A contrapartida aparece no orçamento: você precisa suportar um pagamento maior desde o início. A tendência de queda não dispensa acompanhar o contrato, pois correção monetária e seguros podem mudar o boleto. Escolher SAC contando com uma redução garantida do encargo total em todos os meses seria uma expectativa inadequada.',
    },
    { type: 'h2', text: 'Exemplo: R$ 400 mil em 360 meses' },
    {
      type: 'p',
      text: 'Considere um financiamento de R$ 400 mil, por 360 meses, com taxa de 10,5% efetiva ao ano, sem TR, IPCA, seguros ou tarifas. A taxa mensal equivalente é aproximadamente 0,835515568%. O exemplo considera pagamentos mensais regulares, primeira prestação após um mês e nenhuma amortização extraordinária. Não é uma oferta bancária.',
    },
    {
      type: 'table',
      caption: 'Comparação de R$ 400 mil em 360 meses, sem correção ou custos adicionais',
      headers: ['Indicador', 'PRICE', 'SAC'],
      rows: [
        ['Primeira prestação', 'R$ 3.518,03', 'R$ 4.453,17'],
        ['Última prestação', 'R$ 3.518,03', 'R$ 1.120,39'],
        ['Amortização no primeiro mês', 'R$ 175,97', 'R$ 1.111,11'],
        ['Juros no primeiro mês', 'R$ 3.342,06', 'R$ 3.342,06'],
        ['Total de juros', 'R$ 866.490,52', 'R$ 603.242,24'],
        ['Total pago', 'R$ 1.266.490,52', 'R$ 1.003.242,24'],
      ],
    },
    {
      type: 'p',
      text: 'Os juros do primeiro mês são iguais porque saldo inicial e taxa são iguais. A diferença está na amortização: R$ 175,97 na PRICE contra R$ 1.111,11 no SAC. Ao longo dos 360 meses, esse ritmo produz uma diferença de R$ 263.248,28 no total de juros a favor do SAC, dentro dessas premissas.',
    },
    {
      type: 'note',
      text: 'Os valores exibidos foram arredondados para centavos; os totais usam os cálculos antes do arredondamento. Uma planilha contratual pode apresentar pequenos ajustes, além dos efeitos de datas, índices e encargos ausentes neste exemplo.',
    },
    { type: 'h2', text: 'Por que o boleto pode mudar' },
    {
      type: 'p',
      text: 'Prestação financeira e boleto não são sinônimos perfeitos. O encargo mensal pode reunir amortização, juros, seguros e tarifa de administração. Em contratos corrigidos pela TR ou pelo IPCA, conforme o indexador contratado, a atualização do saldo interfere na evolução do financiamento. Uma taxa de juros fixa também pode coexistir com correção monetária.',
    },
    {
      type: 'p',
      text: 'O seguro MIP, de morte e invalidez permanente, pode variar conforme o saldo devedor e a faixa etária dos participantes, segundo a apólice. O DFI cobre danos físicos ao imóvel. Peça a composição do encargo e as regras de atualização antes de chamar uma proposta PRICE de parcela fixa.',
    },
    { type: 'h2', text: 'Amortização extra: reduzir prazo ou prestação' },
    {
      type: 'p',
      text: 'Um pagamento extraordinário reduz o saldo devedor nos dois sistemas. Reduzir prazo antecipa o fim do financiamento; reduzir prestação alivia o compromisso mensal, mantendo o prazo remanescente. Para comparar, solicite simulações com o mesmo aporte e a mesma data, verificando o saldo e o cronograma resultantes.',
    },
    {
      type: 'p',
      text: 'Sem outros aportes, manter um esforço mensal maior e encurtar o prazo tende a reduzir mais os juros futuros. Já diminuir a prestação pode ser preferível quando a prioridade é recuperar folga no orçamento. O CDC assegura liquidação antecipada total ou parcial com redução proporcional de juros e demais acréscimos; isso não devolve automaticamente juros corretamente pagos pelo tempo já decorrido.',
    },
    { type: 'h2', text: 'Qual sistema combina com seu orçamento' },
    {
      type: 'p',
      text: 'Se a prestação inicial do SAC cabe com margem para condomínio, IPTU, manutenção e imprevistos, a amortização mais rápida merece atenção. Se ela aperta o orçamento, avalie a PRICE, mas também um imóvel mais barato ou uma entrada diferente, sem esvaziar a reserva. Aprovação de crédito não substitui planejamento doméstico.',
    },
    {
      type: 'p',
      text: 'Não escolha contando com aumento de salário, bônus ou valorização do imóvel. Trate rendas incertas como oportunidades futuras, não como condição para pagar a prestação. Compare o CET e as condições de cada proposta, lembrando que referenciais variáveis podem ficar fora desse indicador e precisam ser avaliados separadamente.',
    },
    { type: 'h2', text: 'Checklist antes de escolher' },
    {
      type: 'ol',
      items: [
        'Peça propostas SAC e PRICE com valor e prazo comparáveis, registrando eventuais diferenças comerciais.',
        'Confira taxa efetiva, CET, indexador, seguros e condições de desconto.',
        'Teste a primeira prestação no orçamento completo, preservando a reserva de emergência.',
        'Observe o saldo devedor previsto, não apenas o tamanho do primeiro boleto.',
        'Simule aportes realistas, separando redução de prazo e redução de prestação.',
        'Leia o contrato e o demonstrativo de evolução antes de assinar.',
      ],
    },
    {
      type: 'links',
      items: [
        { label: 'Entenda taxa nominal, efetiva e CET', href: '/blog/juros-do-financiamento' },
        { label: 'Planeje aportes para quitar antes', href: '/blog/quitar-financiamento-antes' },
        { label: 'Compare propostas entre bancos', href: '/blog/qual-banco-financia-melhor' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Posso trocar de PRICE para SAC depois da contratação?' },
    {
      type: 'p',
      text: 'Não conte com uma troca automática. Consulte o banco sobre a possibilidade, as condições e a necessidade de nova análise. Antes de aceitar qualquer alteração, peça a nova evolução do saldo e confira o custo total, não apenas a primeira prestação.',
    },
    { type: 'h3', text: 'O saldo pode subir mesmo com as prestações em dia?' },
    {
      type: 'p',
      text: 'Pode ocorrer em contratos indexados quando a atualização monetária supera a amortização do período. Isso é diferente de reincorporar juros já pagos. Confira no demonstrativo quanto corresponde a correção, juros, amortização e outros lançamentos; peça esclarecimentos para diferenças não identificadas.',
    },
    { type: 'h3', text: 'Qual sistema escolher se pretendo vender o imóvel antes?' },
    {
      type: 'p',
      text: 'Compare os pagamentos e o saldo restante até a data provável da venda. A soma de juros em 30 anos não representa sozinha esse objetivo. Considere também a incerteza sobre quando conseguirá vender e mantenha capacidade de pagar o contrato se a venda demorar.',
    },
  ],
  sources: [
    {
      label: 'CAIXA: Cartilha Crédito Imobiliário, sistemas de amortização e indexadores',
      href: 'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/passos_indexadores_amortizacao.pdf',
    },
    {
      label: 'CAIXA: perguntas frequentes sobre novos financiamentos, encargos e seguros',
      href: 'https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-novos-financiamentos/Paginas/default.aspx',
    },
    {
      label: 'CAIXA: perguntas frequentes sobre amortização e contratos existentes',
      href: 'https://www.caixa.gov.br/voce/habitacao/perguntas-frequentes-contrato/Paginas/default.aspx',
    },
    {
      label: 'Planalto: Código de Defesa do Consumidor, artigo 52, parágrafo 2º',
      href: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    },
  ],
};

export default artigo;
