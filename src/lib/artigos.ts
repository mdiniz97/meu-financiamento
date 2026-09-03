export interface ArticleBlock {
  type: 'p' | 'h2' | 'ul' | 'note';
  text?: string;
  items?: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  readMinutes: number;
  cta: { label: string; href: string };
  blocks: ArticleBlock[];
}

export const ARTIGOS: Article[] = [
  {
    slug: 'quanto-preciso-para-comprar',
    title: 'Entrada e custos da compra: quanto você precisa ter em mãos',
    description:
      'Além do financiamento, a compra de um imóvel exige entrada, ITBI, escritura e registro. Veja o que entra na conta e quanto guardar.',
    updatedAt: '2026-09-02',
    readMinutes: 4,
    cta: { label: 'Calcular meus custos de compra', href: '/custos-da-compra' },
    blocks: [
      { type: 'p', text: 'Muita gente se surpreende ao descobrir que o financiamento não cobre a compra inteira. O banco financia até 80% do imóvel (às vezes 90% em condições especiais), e o restante precisa sair do seu bolso antes da escritura.' },
      { type: 'h2', text: 'Entrada: o primeiro e maior item' },
      { type: 'p', text: 'A entrada é a diferença entre o valor do imóvel e o valor financiado. Em um imóvel de R$ 500 mil com financiamento de 80%, são R$ 100 mil à vista. Quanto maior a entrada, menor o saldo financiado, a parcela e o total de juros no fim.' },
      { type: 'h2', text: 'ITBI, escritura e registro' },
      { type: 'p', text: 'Antes de o imóvel ser seu, a prefeitura cobra o ITBI (Imposto sobre Transmissão de Bens Imóveis), que varia por município, geralmente entre 2% e 3,5% do valor. Depois, o cartório cobra a escritura e o registro da matrícula no seu nome, tipicamente mais 1% a 2%.' },
      { type: 'p', text: 'Somados à entrada de 20%, esses custos costumam fazer o total à vista ficar perto de 25% do valor do imóvel.' },
      { type: 'h2', text: 'O que mais pode entrar na conta' },
      { type: 'ul', items: ['Avaliação do imóvel pelo banco e vistoria', 'Certidões de matrícula e de ônus', 'Reconhecimento de firma e emolumentos', 'Mudança, reformas urgentes e imposto de renda sobre a venda do antigo (se houver)'] },
      { type: 'note', text: 'Regra prática: se o imóvel custa X, tenha entre 25% e 30% de X em liquidez antes de fechar negócio. Assim você cobre entrada, impostos, cartório e imprevistos sem estourar a reserva de emergência.' },
      { type: 'h2', text: 'Quanto você precisa, no seu caso' },
      { type: 'p', text: 'Os percentuais mudam por estado e município. Informe o valor do imóvel, a entrada e o seu estado na nossa calculadora para ver o total que precisa ter em mãos, item por item.' },
    ],
  },
  {
    slug: 'sac-ou-price',
    title: 'SAC vs PRICE: qual sistema de amortização é melhor para você?',
    description:
      'No SAC a parcela começa alta e cai; no PRICE ela fica constante. Entenda a diferença no total pago e qual faz sentido para o seu orçamento.',
    updatedAt: '2026-09-02',
    readMinutes: 5,
    cta: { label: 'Comparar SAC e PRICE no simulador', href: '/nova-simulacao' },
    blocks: [
      { type: 'p', text: 'No financiamento imobiliário brasileiro, dois sistemas dominam: SAC (Sistema de Amortização Constante) e PRICE (parcelas fixas). A taxa de juros é a mesma; o que muda é o formato da parcela e, com ele, o total pago.' },
      { type: 'h2', text: 'PRICE: parcela constante do início ao fim' },
      { type: 'p', text: 'No PRICE a parcela é igual todos os meses. No começo, quase tudo é juro e pouco abate o saldo devedor. Isso faz o saldo demorar mais para cair, e o total de juros pagos ser maior que no SAC para a mesma taxa e prazo.' },
      { type: 'h2', text: 'SAC: parcela que começa alta e cai' },
      { type: 'p', text: 'No SAC a amortização do saldo é fixa, então a parcela começa maior e diminui mês a mês, acompanhando a queda dos juros. Como o saldo cai mais rápido, o total de juros é menor.' },
      { type: 'h2', text: 'Exemplo prático' },
      { type: 'ul', items: ['R$ 400 mil, taxa de 10,5% a.a., prazo de 360 meses', 'PRICE: parcela fixa de cerca de R$ 3.518, total pago de R$ 1,27 milhão', 'SAC: primeira parcela de cerca de R$ 4.453, última de R$ 1.120, total de R$ 1,00 milhão'] },
      { type: 'note', text: 'No exemplo acima o SAC economiza cerca de R$ 263 mil em juros, mas exige uma parcela inicial cerca de 27% maior. A escolha é entre caixa hoje e economia no longo prazo.' },
      { type: 'h2', text: 'Qual escolher?' },
      { type: 'ul', items: ['Escolha SAC se o orçamento aguenta a parcela inicial maior e você quer pagar menos juros no total', 'Escolha PRICE se a parcela precisa caber no orçamento desde o primeiro mês e a renda tende a subir com o tempo', 'Qualquer valor extra pago antecipado reduz o saldo e os juros nos dois sistemas'] },
      { type: 'p', text: 'Simule os dois sistemas com os seus números: valor, taxa e prazo reais mudam completamente a conta.' },
    ],
  },
  {
    slug: 'quitar-financiamento-antes',
    title: 'Quitar o financiamento antes: vale a pena pagar aporte extra?',
    description:
      'Aportes mensais extras encurtam o prazo e cortam juros. Veja quanto você precisa aportar para quitar antes e quando faz sentido.',
    updatedAt: '2026-09-02',
    readMinutes: 4,
    cta: { label: 'Calcular meu aporte para quitar antes', href: '/meta-de-quitacao' },
    blocks: [
      { type: 'p', text: 'Seu financiamento foi feito para durar 30 anos, mas nada impede você de encerrá-lo em 10 ou 15. Cada real pago além da parcela abate o saldo devedor e os juros deixam de incidir sobre ele.' },
      { type: 'h2', text: 'Como o aporte extra funciona' },
      { type: 'p', text: 'Você mantém a parcela normal e adiciona um valor mensal (ou faz amortizações pontuais, como com o FGTS). O pagamento total por mês sobe, mas o prazo encurta e a economia de juros costuma ser grande, porque os juros são o maior custo do financiamento.' },
      { type: 'ul', items: ['Aporte maior que a parcela reduz o saldo mais rápido', 'Prazo menor significa menos meses de juros', 'A economia total é a diferença entre os juros do prazo original e os do novo prazo'] },
      { type: 'h2', text: 'Um exemplo' },
      { type: 'p', text: 'Em um saldo de R$ 400 mil a 10,5% a.a. em 360 meses, quitar em 10 anos exige um aporte mensal de cerca de R$ 1.774 acima da parcela atual. A economia de juros chega a cerca de R$ 631 mil em relação ao prazo cheio.' },
      { type: 'h2', text: 'Quando NÃO vale a pena' },
      { type: 'ul', items: ['Sem reserva de emergência: primeiro monte 6 a 12 meses de custos', 'Se o dinheiro rende mais que a taxa do financiamento após impostos (hoje, com a Selic alta, investir pode ganhar da taxa do contrato)', 'Se o aporte comprometer a entrada de outros objetivos, como a compra de um novo imóvel'] },
      { type: 'note', text: 'No SAC a parcela já cai com o tempo, então o aporte necessário no primeiro mês é menor do que parece e cresce conforme a parcela diminui. Calcule o seu caso antes de decidir.' },
      { type: 'p', text: 'Informe saldo, taxa, prazo e a meta de quitação na nossa ferramenta: ela mostra o aporte mensal exato e a economia de juros.' },
    ],
  },
  {
    slug: 'qual-banco-financia-melhor',
    title: 'Qual banco financia melhor? Como comparar taxas por instituição',
    description:
      'As taxas de financiamento variam muito entre bancos. Entenda de onde vêm os dados oficiais e como a diferença afeta sua parcela.',
    updatedAt: '2026-09-02',
    readMinutes: 4,
    cta: { label: 'Ver taxas por instituição', href: '/juros' },
    blocks: [
      { type: 'p', text: 'Dois bancos podem oferecer taxas bem diferentes para o mesmo financiamento. A diferença de um ponto percentual em 30 anos muda a parcela em centenas de reais e o total pago em dezenas de milhares.' },
      { type: 'h2', text: 'Onde encontrar taxas confiáveis' },
      { type: 'p', text: 'O Banco Central publica as taxas médias efetivamente contratadas por cada instituição, atualizadas ao longo do dia. Essas médias consideram as operações reais dos últimos dias úteis, separadas entre mercado (recursos livres) e reguladas (como as do SBPE) e entre prefixado, TR e IPCA.' },
      { type: 'h2', text: 'Por que a taxa do banco pode ser diferente da média' },
      { type: 'p', text: 'A média divulgada é das operações fechadas, não uma oferta. O banco vai te oferecer uma taxa baseada no seu relacionamento, renda, entrada e negociação. Use a média como piso de referência: se a proposta estiver acima, há espaço para negociar.' },
      { type: 'ul', items: ['Taxas menores reduzem a parcela e o total de juros', 'A mesma simulação em 3 bancos pode revelar diferença de R$ 50 mil ou mais em 30 anos', 'Portabilidade é a ferramenta para levar o contrato ao banco com a melhor taxa'] },
      { type: 'note', text: 'Compare sempre o CET (Custo Efetivo Total), que soma juros, seguros e tarifas: um banco com taxa menor na vitrine pode ter seguros mais caros embutidos.' },
      { type: 'h2', text: 'Na prática' },
      { type: 'p', text: 'Acompanhe as taxas médias por instituição na nossa página de juros de mercado e use essa referência para negociar a sua proposta.' },
    ],
  },
  {
    slug: 'selic-alta-investir-ou-amortizar',
    title: 'Selic alta: vale investir ou amortizar o financiamento?',
    description:
      'Com juros altos, investir pode render mais que a taxa do seu contrato. Veja a conta que decide entre aplicar ou abater a dívida.',
    updatedAt: '2026-09-02',
    readMinutes: 5,
    cta: { label: 'Comparar meu caso', href: '/investir-ou-amortizar' },
    blocks: [
      { type: 'p', text: 'Amortizar o financiamento é um investimento com retorno garantido: a taxa do seu contrato. Investir em renda fixa paga a Selic, que hoje é alta. A pergunta é qual dos dois rende mais depois dos impostos e riscos.' },
      { type: 'h2', text: 'O retorno de cada caminho' },
      { type: 'p', text: 'Ao amortizar, cada real pago deixa de render juros de financiamento contra você: é um retorno livre de imposto e risco, exatamente igual à taxa do contrato. Ao investir, você recebe a Selic, mas paga Imposto de Renda sobre o ganho (regressivo, quanto mais tempo, menor).' },
      { type: 'h2', text: 'A regra de bolso' },
      { type: 'ul', items: ['Se a taxa do financiamento é maior que o rendimento líquido do investimento, amortizar ganha', 'Se o rendimento líquido supera a taxa do contrato, investir ganha', 'Com Selic em 10,5% e um financiamento a 10,5% a.a., o IR faz a balança pender para a amortização', 'No SAC, amortizar reduz parcela ou prazo: reduzir o prazo economiza mais juros'] },
      { type: 'note', text: 'Amortizar também melhora seu caixa no longo prazo e reduz o risco de inadimplência. Só não use dinheiro da reserva de emergência para quitar dívida.' },
      { type: 'h2', text: 'Estratégias combinadas' },
      { type: 'p', text: 'Você não precisa escolher um só caminho. Muitos usam parte do dinheiro para amortizar (retorno garantido da taxa do contrato) e parte para investir (liquidez), dividindo o risco. A ferramenta de investir ou amortizar simula as estratégias de reduzir parcela, reduzir prazo e investir com o rendimento.' },
    ],
  },
  {
    slug: 'portabilidade-de-financiamento',
    title: 'Portabilidade de financiamento: como trocar de banco e pagar menos',
    description:
      'Se outro banco oferece taxa menor, a portabilidade transfere seu contrato sem custo adicional. Veja como funciona e quanto pode economizar.',
    updatedAt: '2026-09-02',
    readMinutes: 4,
    cta: { label: 'Simular minha portabilidade', href: '/portabilidade' },
    blocks: [
      { type: 'p', text: 'Portabilidade é o direito de transferir seu financiamento para outro banco, mantendo saldo e prazo, sem custo de quitação. Na prática, é uma nova operação: o banco novo paga o saldo devedor e te dá um contrato com a taxa que ele oferecer.' },
      { type: 'h2', text: 'Quando vale a pena' },
      { type: 'p', text: 'Vale quando a taxa nova, somando seguros e tarifas (o CET), é menor que a do seu contrato atual. Como o saldo costuma ser alto, cada 0,5 ponto percentual faz diferença grande.' },
      { type: 'h2', text: 'Um exemplo' },
      { type: 'p', text: 'Em um saldo de R$ 300 mil com 360 meses restantes, sair de 11% a.a. para 9,5% a.a. reduz a parcela em cerca de R$ 302 por mês: mais de R$ 108 mil em 30 anos, mesmo prazo.' },
      { type: 'ul', items: ['O banco novo assume o saldo devedor e o prazo restante', 'Não há multa ou IOF na portabilidade', 'Compare sempre o CET, não só a taxa', 'O banco atual tem direito de preferência: pode cobrir a proposta'] },
      { type: 'note', text: 'Os custos da portabilidade (avaliação, registro, ITBI na alienação fiduciária quando houver) costumam ser pequenos perto da economia. Peça o contrato por escrito e simule antes de assinar.' },
      { type: 'h2', text: 'Como simular o seu caso' },
      { type: 'p', text: 'Informe saldo, prazo, taxa e seguro atuais e a proposta do novo banco: a ferramenta compara manter com portar e mostra a economia real de juros.' },
    ],
  },
  {
    slug: 'juros-do-financiamento',
    title: 'Juros do financiamento: nominal, efetiva e CET na prática',
    description:
      'Entenda juros compostos, a diferença entre taxa nominal e efetiva e por que o CET é o número que importa para comparar propostas.',
    updatedAt: '2026-09-02',
    readMinutes: 5,
    cta: { label: 'Simular meu financiamento', href: '/nova-simulacao' },
    blocks: [
      { type: 'p', text: 'A taxa do financiamento não é um número único: dependendo de como o banco apresenta, o mesmo custo parece menor ou maior. Entender nominal, efetiva e CET evita surpresas na hora de comparar propostas.' },
      { type: 'h2', text: 'Juros compostos: o efeito bola de neve' },
      { type: 'p', text: 'No financiamento, os juros incidem sobre o saldo devedor, que muda todo mês. Como o saldo inclui juros anteriores ainda não pagos, os juros crescem sobre juros. É por isso que, em 30 anos, o total pago pode chegar a mais de 3 vezes o valor financiado, mesmo com taxas consideradas baixas.' },
      { type: 'h2', text: 'Taxa nominal x taxa efetiva' },
      { type: 'p', text: 'Taxa nominal é a taxa anunciada no ano. Como as parcelas são mensais, o banco aplica a fração mensal dela e capitaliza mês a mês: 12% nominal a.a. com parcelas mensais equivalem a cerca de 12,68% a.a. efetivos. Quem compara apenas o número nominal subestima o custo real.' },
      { type: 'ul', items: ['Nominal: a taxa de propaganda, sem considerar a capitalização mensal', 'Efetiva: a taxa que de fato incide, considerando juros sobre juros', 'Sempre compare propostas pela taxa efetiva ou pelo CET'] },
      { type: 'h2', text: 'Como a parcela é calculada' },
      { type: 'p', text: 'A parcela mensal é definida pela taxa efetiva, pelo saldo e pelo prazo: com mais prazo, a parcela cai, mas o total de juros sobe; com menos prazo, a parcela sobe e o total cai. Sistema PRICE mantém a parcela fixa; o SAC a reduz com o tempo.' },
      { type: 'h2', text: 'CET: o custo de verdade' },
      { type: 'p', text: 'O CET (Custo Efetivo Total) soma à taxa os seguros, tarifas e outros encargos do contrato. Dois bancos com a mesma taxa podem ter CETs diferentes por causa dos seguros embutidos. Por lei, a proposta precisa informar o CET antes da assinatura.' },
      { type: 'note', text: 'Regra simples: simule o mesmo valor e prazo nos bancos que quiser e compare o CET de cada um. A diferença de 0,5 ponto no CET pode significar dezenas de milhares de reais no prazo de 30 anos.' },
      { type: 'h2', text: 'Onde consultar taxas atuais' },
      { type: 'p', text: 'Acompanhe as taxas médias efetivamente contratadas por instituição na nossa página de juros de mercado e use como referência para negociar.' },
    ],
  },

];

export function getArtigo(slug: string): Article | undefined {
  return ARTIGOS.find((a) => a.slug === slug);
}
