import type { Article } from './types';

const artigo: Article = {
  slug: 'quanto-preciso-para-comprar',
  title: 'Entrada e custos da compra: quanto você precisa ter em mãos',
  description:
    'Organize entrada, ITBI, registro e avaliação, entenda quando o contrato substitui a escritura e preserve sua reserva na compra do imóvel.',
  updatedAt: '2026-09-08',
  cta: {
    label: 'Calcular meus custos de compra',
    href: '/custos-da-compra',
  },
  blocks: [
    {
      type: 'p',
      text: 'Você precisa reunir a parte do preço que não será coberta pelo financiamento e os custos da compra que serão pagos com recursos próprios. Além disso, deve preservar uma reserva para emergências. Não existe percentual único que resolva essa conta: a entrada depende do crédito aprovado, o ITBI depende do município e as despesas de cartório dependem dos atos necessários e da tabela aplicável.',
    },
    { type: 'h2', text: 'A entrada não é um percentual fixo' },
    {
      type: 'p',
      text: 'A entrada é a diferença entre o preço combinado e o financiamento destinado à compra. Se o imóvel custa R$ 500 mil e o crédito aprovado é de R$ 400 mil, faltam R$ 100 mil para pagar o vendedor. Essa diferença não inclui, por si só, imposto, registro, avaliação ou mudança. Também não significa que tudo vença no mesmo dia: o cronograma precisa constar da negociação.',
    },
    {
      type: 'p',
      text: 'A cota de crédito, também chamada de LTV, relaciona o valor da operação ao valor de avaliação da garantia. Na regra consultada do Banco Central, principal e despesas acessórias entram nesse cálculo. Para aquisição residencial por pessoa física, o limite geral é de 80%, admitindo até 90% em SAC ou Sacre. São tetos regulatórios, não promessa de financiamento: a instituição pode aprovar menos conforme a linha, sua renda, outras dívidas e o imóvel.',
    },
    { type: 'h2', text: 'A avaliação pode aumentar a entrada' },
    {
      type: 'p',
      text: 'O preço negociado com o vendedor pode ser diferente da avaliação aceita pelo banco. Imagine um imóvel de R$ 500 mil avaliado em R$ 450 mil. Com cota aprovada de 80% sobre essa avaliação, sem despesas financiadas, o crédito seria de R$ 360 mil. A diferença para o preço chegaria a R$ 140 mil, e não aos R$ 100 mil esperados por quem aplicou 80% diretamente sobre o anúncio.',
    },
    {
      type: 'p',
      text: 'Por isso, não comprometa todo o dinheiro em um sinal contando apenas com a simulação inicial. Antes de assumir obrigações, confirme as condições de aprovação e negocie por escrito o que acontece se o crédito sair menor ou não for concedido. Uma pré-análise de renda não substitui a análise completa da operação.',
    },
    { type: 'h2', text: 'O ITBI depende do município' },
    {
      type: 'p',
      text: 'O Imposto sobre Transmissão de Bens Imóveis é municipal, não estadual. A prefeitura do local do imóvel informa alíquotas, benefícios, documentos e procedimentos de recolhimento. Duas cidades do mesmo estado podem ter regras diferentes. Portanto, uma estimativa identificada apenas pela UF não determina quanto você efetivamente pagará.',
    },
    {
      type: 'p',
      text: 'Confira a base de cálculo utilizada no seu caso e as condições de eventual redução ou isenção. Não confunda automaticamente preço de compra, avaliação bancária e valor usado para IPTU. Se houver divergência sobre a cobrança, peça esclarecimentos à prefeitura antes de simplesmente trocar o valor da guia. Ser a primeira compra, isoladamente, não cria uma isenção nacional de ITBI.',
    },
    { type: 'h2', text: 'Escritura e registro são despesas diferentes' },
    {
      type: 'p',
      text: 'A escritura pública formaliza o negócio quando esse instrumento é necessário. Nos contratos abrangidos pela Lei nº 9.514/1997, o instrumento particular pode ter efeitos de escritura pública. Assim, um contrato bancário adequado pode cumprir essa função sem exigir uma escritura pública separada. Não some os dois custos automaticamente, mas confirme com o banco e o cartório qual título será utilizado.',
    },
    {
      type: 'p',
      text: 'Isso não elimina o registro no Cartório de Registro de Imóveis competente. O título da compra e a garantia precisam receber os atos correspondentes na matrícula. Peça orçamento discriminado, identificando registros, averbações e certidões. Os emolumentos seguem tabelas estaduais ou do Distrito Federal; não existe percentual nacional oficial de cartório que sirva para qualquer imóvel.',
    },
    { type: 'h2', text: 'Quando existe desconto na primeira aquisição' },
    {
      type: 'p',
      text: 'O artigo 290 da Lei de Registros Públicos prevê redução de 50% dos emolumentos dos atos relacionados à primeira aquisição imobiliária para fins residenciais financiada pelo Sistema Financeiro da Habitação, o SFH. As condições precisam estar presentes em conjunto. Não basta estar comprando um imóvel, nem qualquer financiamento imobiliário necessariamente se enquadra nessa regra.',
    },
    {
      type: 'p',
      text: 'Informe essa situação ao cartório e peça a relação de documentos necessários para comprovar o enquadramento. O desconto não reduz pela metade a entrada, a avaliação bancária ou o ITBI. Benefícios tributários municipais e outros programas habitacionais têm regras próprias, que devem ser verificados separadamente.',
    },
    { type: 'h2', text: 'Exemplo de orçamento para um imóvel de R$ 500 mil' },
    {
      type: 'p',
      text: 'Neste exemplo hipotético, o crédito aprovado é de R$ 400 mil e nenhuma despesa acessória será financiada. Adotamos ITBI de 3% sobre R$ 500 mil apenas para ilustrar a conta. Os demais valores também são hipóteses, não cotações ou tabelas oficiais.',
    },
    {
      type: 'table',
      caption: 'Desembolso próprio hipotético, sem incluir a reserva de emergência',
      headers: ['Item', 'Valor previsto'],
      rows: [
        ['Entrada: preço menos crédito aprovado', 'R$ 100.000'],
        ['ITBI hipotético: 3% sobre R$ 500.000', 'R$ 15.000'],
        ['Registro hipotético', 'R$ 4.000'],
        ['Avaliação hipotética', 'R$ 2.000'],
        ['Certidões e outros gastos hipotéticos', 'R$ 1.000'],
        ['Total previsto para a compra', 'R$ 122.000'],
      ],
    },
    {
      type: 'p',
      text: 'Consideramos que o contrato bancário terá efeitos de escritura pública, sem escritura separada. O registro de R$ 4 mil é uma hipótese do orçamento, sem presumir desconto. Os R$ 122 mil representam desembolsos da compra conforme seus vencimentos, não o dinheiro que pode ficar disponível depois. Reforma, móveis, mudança e reserva ainda precisam de planejamento próprio.',
    },
    { type: 'h2', text: 'Separe despesas extras da reserva de emergência' },
    {
      type: 'p',
      text: 'Mudança, reparos, instalação de serviços e eventual sobreposição de aluguel com prestações são gastos previsíveis. Estime cada um em reais e marque a data provável de pagamento. Se o imóvel precisar de obra imediata para ser habitável, esse valor deve entrar na decisão de compra, não ser tratado como surpresa futura.',
    },
    {
      type: 'p',
      text: 'A reserva de emergência tem outra função: proteger o orçamento diante de perda de renda ou despesa inesperada. Mantenha esse dinheiro separado da entrada e dos impostos. Se pagar a compra deixar seu caixa zerado, considere negociar o preço, ajustar o imóvel procurado ou esperar. Uma prestação que cabe na renda não compensa a falta de dinheiro para concluir a aquisição.',
    },
    { type: 'h2', text: 'Checklist antes de assumir o compromisso' },
    {
      type: 'ol',
      items: [
        'Confirme o preço final, o sinal já pago e o calendário dos pagamentos ao vendedor.',
        'Obtenha a proposta bancária e identifique o crédito aprovado, a avaliação e as despesas financiadas.',
        'Consulte a prefeitura sobre ITBI, base de cálculo e benefícios aplicáveis.',
        'Peça ao cartório orçamento por ato e verifique o desconto condicionado do SFH.',
        'Solicite ao banco os custos de avaliação e demais cobranças por escrito.',
        'Some mudança e reparos, mantendo a reserva de emergência fora do dinheiro comprometido.',
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Ter 20% do preço guardados é suficiente?' },
    {
      type: 'p',
      text: 'Não necessariamente. Esse valor pode cobrir apenas a entrada, caso o financiamento alcance os outros 80% do preço. Uma avaliação menor ou aprovação de crédito inferior aumenta a diferença. Imposto, registro e despesas não financiadas continuam existindo.',
    },
    { type: 'h3', text: 'Posso incluir impostos e cartório no financiamento?' },
    {
      type: 'p',
      text: 'Algumas operações permitem financiar despesas acessórias, conforme a linha e a aprovação. Confirme quais entram e quanto sobra para pagar o vendedor. Financiar uma despesa não a elimina: ela passa a compor a dívida e pode gerar juros.',
    },
    { type: 'h3', text: 'O sinal deve ser somado novamente à entrada?' },
    {
      type: 'p',
      text: 'Se o contrato prevê que o sinal será abatido do preço, ele já compõe a parcela de recursos próprios destinada ao vendedor. Registre o que foi pago e calcule apenas o restante, evitando contar o mesmo desembolso duas vezes.',
    },
    { type: 'h2', text: 'Use a calculadora como ponto de partida' },
    {
      type: 'p',
      text: 'A calculadora atual de custos da compra do amortiza.me oferece uma estimativa simplificada por UF, com percentuais aproximados. Ela não substitui a consulta à prefeitura, o orçamento do cartório ou a proposta bancária. Use o resultado para organizar o planejamento inicial; depois substitua as hipóteses pelos valores documentados do seu caso e ajuste a eventual dispensa de escritura separada.',
    },
    {
      type: 'links',
      items: [
        { label: 'Estimar os custos da compra', href: '/custos-da-compra' },
        { label: 'Entender juros, taxa efetiva e CET', href: '/blog/juros-do-financiamento' },
        { label: 'Comparar os sistemas SAC e Price', href: '/blog/sac-ou-price' },
      ],
    },
  ],
  sources: [
    {
      label: 'Banco Central: Resolução nº 4.676/2018, cota de crédito, avaliação e concessão',
      href: 'https://normativos.bcb.gov.br/Lists/Normativos/Attachments/50628/Res_4676_v17_L.pdf',
    },
    {
      label: 'Constituição Federal: artigo 156, competência municipal do ITBI',
      href: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    },
    {
      label: 'Lei nº 9.514/1997: artigos 23 e 38, registro e instrumento com efeitos de escritura',
      href: 'https://www.planalto.gov.br/ccivil_03/leis/l9514.htm',
    },
    {
      label: 'Lei nº 6.015/1973: artigos 14, 167 e 290, emolumentos, registro e desconto no SFH',
      href: 'https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm',
    },
  ],
};

export default artigo;
