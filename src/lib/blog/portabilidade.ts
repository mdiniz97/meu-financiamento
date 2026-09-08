import type { Article } from './types';

const artigo: Article = {
  slug: 'portabilidade-de-financiamento',
  title: 'Portabilidade de financiamento: como trocar de banco e pagar menos',
  description:
    'Entenda como comparar propostas de portabilidade pelo CET, considerar avaliação e averbação e calcular se a economia compensa a troca de banco.',
  updatedAt: '2026-09-08',
  cta: {
    label: 'Simular minha portabilidade',
    href: '/portabilidade',
  },
  blocks: [
    {
      type: 'p',
      text: 'A portabilidade imobiliária pode reduzir o custo do financiamento, mas uma taxa de juros menor não garante que trocar de banco seja melhor. Compare os pagamentos que ainda faltam, o CET da proposta, o indexador e os gastos da mudança. Os custos da transferência de recursos entre bancos não podem ser repassados ao devedor; isso não significa que avaliação e averbação sejam sempre gratuitas.',
    },
    { type: 'h2', text: 'O que muda quando você troca de banco' },
    {
      type: 'p',
      text: 'Na portabilidade, você solicita que uma nova instituição receba sua operação de crédito. O banco novo transfere os recursos para liquidar a dívida no banco original, e a relação de pagamento passa a seguir as condições formalizadas com o novo credor. No crédito imobiliário, também é necessário documentar a sub-rogação da dívida e da garantia para averbação no Registro de Imóveis.',
    },
    {
      type: 'p',
      text: 'Não se trata de vender o imóvel nem de receber dinheiro para quitar a dívida por conta própria. Você precisa encontrar uma instituição interessada em receber a operação e passar pela análise exigida. O direito à portabilidade não obriga qualquer banco a aprovar sua proposta. Encontrada uma operação apta à transferência, o credor original deve cumprir o procedimento, não dificultá-lo para reter o cliente.',
    },
    { type: 'h2', text: 'Compare CET, indexador e pagamentos restantes' },
    {
      type: 'p',
      text: 'O Custo Efetivo Total é uma taxa anual calculada a partir dos fluxos da operação, incluindo juros, tarifas, tributos, seguros e outras despesas vinculadas. Peça o demonstrativo antes de contratar. Ele permite entender por que uma taxa anunciada menor pode vir acompanhada de seguros ou despesas que reduzem a vantagem.',
    },
    {
      type: 'p',
      text: 'Há um limite importante: referenciais variáveis, como taxas flutuantes e índices de preços, não entram no cálculo do CET e devem ser informados separadamente. Compare a correção pela TR, pelo IPCA ou outra base contratada. O CET não transforma o comportamento futuro de um indexador em certeza.',
    },
    {
      type: 'p',
      text: 'Para decidir hoje, compare os desembolsos futuros a partir da mesma data. O CET original pode refletir despesas que você já pagou e não recuperará. Evite comparar todo o custo histórico do financiamento com apenas o custo restante da proposta nova. Confira também se despesas já incluídas no demonstrativo não estão sendo somadas novamente.',
    },
    { type: 'h2', text: 'Saldo e prazo têm limites, não garantias' },
    {
      type: 'p',
      text: 'Em regra, o valor da nova operação não pode superar o saldo devedor, e o prazo não pode superar o período remanescente, considerados na data da transferência. Isso não obriga a manter exatamente o mesmo prazo. A regulamentação admite exceção ao limite de prazo quando a modalidade de crédito muda, situação que exige examinar as novas condições, e não presumir que tudo continua igual.',
    },
    {
      type: 'p',
      text: 'Se a nova prestação for maior, a instituição deve obter sua concordância formal e específica. Encurtar o prazo pode aumentar a parcela e reduzir juros futuros, mas muda a comparação com manter o contrato. Para isolar o efeito da taxa, comece simulando o mesmo saldo, prazo e sistema de amortização.',
    },
    { type: 'h2', text: 'Quais custos podem aparecer na mudança' },
    {
      type: 'p',
      text: 'A Resolução CMN nº 5.057 proíbe repassar ao devedor os custos de comunicação e transferência interbancária, assim como o ressarcimento de originação entre instituições. Separe essas despesas das cobranças ligadas à garantia. Antes de autorizar serviços, peça um orçamento discriminado e confirme quem pagará cada item.',
    },
    {
      type: 'ul',
      items: [
        'Avaliação ou reavaliação: pode ser cobrada na requisição de portabilidade, nas condições da regulamentação, com anuência prévia e informação do valor máximo.',
        'Averbação: a mudança do credor e da garantia exige ato registral, com emolumentos conforme a tabela aplicável.',
        'Seguros e demais despesas: confira valores, coberturas e condições da proposta, sem assumir que serão iguais aos do contrato atual.',
      ],
    },
    { type: 'h2', text: 'IOF e ITBI não cabem em uma promessa universal' },
    {
      type: 'p',
      text: 'O regulamento do IOF prevê alíquota zero para cobertura de saldo em outra instituição até o montante portado, sem substituição do devedor, observadas suas condições. Há também isenção própria para operações com finalidade habitacional. Alterações contratuais, mudança de finalidade ou crédito adicional exigem análise específica. Não estenda automaticamente o tratamento da portabilidade a um empréstimo com dinheiro extra, conhecido como troco.',
    },
    {
      type: 'p',
      text: 'Na portabilidade pura, muda o credor, não o comprador do imóvel. Por isso, não inclua um novo ITBI automaticamente como se houvesse outra compra. Uma venda ou transferência de direitos associada é situação diferente. Se a proposta trouxer imposto, peça a identificação do fato tributado e esclareça o enquadramento com o banco e, no caso do ITBI, com a prefeitura.',
    },
    { type: 'h2', text: 'Exemplo hipotético de portabilidade pela tabela Price' },
    {
      type: 'p',
      text: 'Considere saldo de R$ 300 mil e 360 meses restantes, com pagamentos mensais pela tabela Price. Vamos comparar juros efetivos de 11% ao ano com 9,5% ao ano, convertidos em taxas mensais equivalentes. Para enxergar apenas o efeito dos juros, o cálculo exclui indexador, seguros e tarifas. Não são ofertas reais de instituições.',
    },
    {
      type: 'table',
      caption: 'Comparação hipotética, com o mesmo saldo, prazo e sistema',
      headers: ['Condição', 'Contrato atual', 'Nova proposta'],
      rows: [
        ['Saldo financiado', 'R$ 300.000', 'R$ 300.000'],
        ['Prazo restante', '360 meses', '360 meses'],
        ['Juros efetivos anuais', '11%', '9,5%'],
        ['Prestação financeira aproximada', 'R$ 2.740,07', 'R$ 2.437,62'],
      ],
    },
    {
      type: 'p',
      text: 'A diferença calculada antes do arredondamento é de aproximadamente R$ 302,4565 por mês, ou R$ 302,46 na apresentação em centavos. Em 360 meses, são R$ 108.884,34 de economia bruta nominal. Esse total não desconta o valor do dinheiro no tempo nem considera custos da mudança. Usar números internos sem arredondamento explica pequenas diferenças ao multiplicar os valores exibidos.',
    },
    { type: 'h2', text: 'Calcule a recuperação dos gastos e avalie a contraproposta' },
    {
      type: 'p',
      text: 'Se a mudança custar hipoteticamente R$ 4 mil pagos à vista, dividir esse valor pela economia de R$ 302,46 dá cerca de 13,23 meses. Arredondando para cima, a recuperação simples ocorre no 14º mês. Isso pressupõe economia constante e ignora o desconto dos fluxos. Se você pretende vender ou quitar antes, pode não recuperar o desembolso.',
    },
    {
      type: 'p',
      text: 'O banco atual pode oferecer uma contraproposta para manter você como cliente. Isso não é um direito de preferência que obrigue sua permanência. Compare a renegociação documentada com a proposta externa, incluindo despesas evitadas e condições alteradas. Se decidir desistir da transferência, formalize a decisão e confirme seu recebimento, em vez de apenas interromper as conversas.',
    },
    { type: 'h2', text: 'Checklist para solicitar a portabilidade' },
    {
      type: 'ol',
      items: [
        'Obtenha o Documento Descritivo do Crédito, com saldo atualizado, evolução, taxas, prazos e parcelas discriminadas.',
        'Reúna contrato e documentos pessoais e do imóvel solicitados pelo banco receptor.',
        'Peça proposta escrita, demonstrativo do CET e orçamento dos serviços, identificando despesas à vista.',
        'Compare cenários equivalentes e avalie eventual contraproposta do banco atual.',
        'Solicite formalmente a portabilidade ao novo banco e guarde a requisição e o protocolo.',
        'Acompanhe transferência, comprovação e averbação; confirme os próximos pagamentos e mantenha as obrigações em dia durante o processo.',
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'O processo inteiro termina em cinco dias úteis?' },
    {
      type: 'p',
      text: 'Não. Esse prazo regulamentar se refere à solicitação de recursos pelo credor original no sistema eletrônico; pelo Open Finance, quando aplicável, são três dias úteis. Análise da proposta, documentação, transferência e cartório têm etapas próprias. Peça um cronograma, sem tratar esse prazo como garantia de conclusão total.',
    },
    { type: 'h3', text: 'Posso portar um financiamento enquadrado no SFH?' },
    {
      type: 'p',
      text: 'Sim. A operação que já pertence ao SFH permanece nesse sistema após a portabilidade, observando suas disposições legais e regulamentares, com a exceção prevista para o limite máximo de avaliação do imóvel. Confirme as condições específicas do contrato com a instituição receptora.',
    },
    { type: 'h3', text: 'Uma parcela menor comprova que vou pagar menos?' },
    {
      type: 'p',
      text: 'Não isoladamente. Confira prazo, sistema de amortização, indexador e despesas. Uma parcela menor pode refletir outra distribuição dos pagamentos, não economia total. A comparação precisa mostrar o que será pago até a quitação em cada cenário, com as mesmas premissas.',
    },
    { type: 'h2', text: 'Simule com a proposta documentada' },
    {
      type: 'p',
      text: 'O simulador de portabilidade do amortiza.me fica na área autenticada e exige o Plano Ilimitado. Use os dados do contrato e da proposta para comparar cenários; a ferramenta não aprova crédito nem substitui documentos bancários. Se houver mudança de prazo ou indexador, revise as premissas antes de interpretar a economia projetada.',
    },
    {
      type: 'links',
      items: [
        { label: 'Simular portabilidade na área do Plano Ilimitado', href: '/portabilidade' },
        { label: 'Entender taxa efetiva e CET', href: '/blog/juros-do-financiamento' },
        { label: 'Aprender a comparar propostas bancárias', href: '/blog/qual-banco-financia-melhor' },
      ],
    },
  ],
  sources: [
    {
      label: 'Banco Central: Resolução CMN nº 5.057/2022, regras e custos da portabilidade',
      href: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=5057',
    },
    {
      label: 'Banco Central: Resolução CMN nº 4.881/2020, cálculo e informação do CET',
      href: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4881',
    },
    {
      label: 'Banco Central: Resolução nº 4.676/2018, artigo 8º-A, avaliação na portabilidade',
      href: 'https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50628/Res_4676_v17_L.pdf',
    },
    {
      label: 'Decreto nº 6.306/2007: artigos 8º e 9º, condições do IOF e crédito habitacional',
      href: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/D6306compilado.htm',
    },
  ],
};

export default artigo;
