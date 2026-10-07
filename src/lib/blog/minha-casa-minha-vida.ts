import type { Article } from './types';

const artigo: Article = {
  slug: 'minha-casa-minha-vida',
  title: 'Minha Casa Minha Vida: como funciona, faixas e quem tem direito',
  description:
    'Entenda como o Minha Casa Minha Vida organiza as famílias por faixa de renda, o papel do subsídio e das taxas reduzidas, os requisitos e o uso do FGTS.',
  updatedAt: '2026-10-07',
  cta: { label: 'Descobrir qual imóvel cabe no meu bolso', href: '/qual-imovel-cabe-no-meu-bolso' },
  blocks: [
    {
      type: 'p',
      text: 'O Minha Casa Minha Vida é um programa habitacional do governo federal que facilita a compra da casa própria com juros abaixo do mercado e, para as rendas menores, subsídio que reduz o valor a financiar. Em vez de uma taxa única, o programa organiza as famílias por faixa de renda: quanto menor a renda, menor a taxa e maior o apoio.',
    },
    {
      type: 'p',
      text: 'As regras, os limites de renda e as taxas são definidos periodicamente e mudam com o programa. Por isso, trate este texto como um mapa de como funciona, e confirme os valores vigentes nos canais oficiais antes de contar com um cenário específico.',
    },
    { type: 'h2', text: 'Como funcionam as faixas' },
    {
      type: 'p',
      text: 'O programa divide as famílias em faixas conforme a renda mensal, nas modalidades urbana e rural. Em linhas gerais, existem as faixas 1, 2 e 3, e versões recentes do programa também alcançam uma faixa de renda mais alta. Cada faixa tem taxa de juros, limite de valor do imóvel e condições próprias.',
    },
    {
      type: 'table',
      caption: 'Lógica geral das faixas urbanas',
      headers: ['Faixa', 'Renda', 'Apoio típico'],
      rows: [
        ['Faixa 1', 'Menor renda', 'Taxa menor e subsídio que reduz o valor financiado'],
        ['Faixa 2', 'Renda intermediária', 'Taxa reduzida; subsídio menor ou parcial'],
        ['Faixa 3', 'Renda maior dentro do programa', 'Taxa ainda abaixo do mercado, geralmente sem subsídio'],
      ],
    },
    {
      type: 'p',
      text: 'A tabela resume a lógica, não os valores. Os limites de renda e as taxas de cada faixa são atualizados pelo governo e pelos agentes financeiros, então consulte a tabela vigente antes de calcular o seu enquadramento.',
    },
    { type: 'h2', text: 'Subsídio e taxas reduzidas' },
    {
      type: 'p',
      text: 'Nas faixas de menor renda, o subsídio é um desconto no valor do imóvel que não precisa ser devolvido, reduzindo quanto a família financia. O valor depende da renda, da localização e da composição familiar. Nas faixas maiores, o benefício costuma vir principalmente na forma de taxa de juros menor.',
    },
    {
      type: 'p',
      text: 'O financiamento em si é feito por um agente financeiro, como a Caixa ou outros bancos habilitados, seguindo as condições do programa. Ou seja: o Minha Casa Minha Vida define as regras e o apoio, mas o contrato é assinado com o banco.',
    },
    { type: 'h2', text: 'Quem tem direito' },
    {
      type: 'ul',
      items: [
        'Famílias com renda mensal dentro dos limites do programa (há faixas diferentes para área urbana e rural).',
        'Quem comprova renda e atende às condições de crédito do agente financeiro.',
        'Quem não possui imóvel residencial próprio na localidade em que pretende comprar.',
        'Quem não recebeu subsídio habitacional anterior em condições semelhantes, conforme as regras vigentes.',
        'Maiores de 18 anos ou emancipados, com documentação em ordem.',
      ],
    },
    { type: 'h2', text: 'O papel do FGTS' },
    {
      type: 'p',
      text: 'O FGTS pode ser usado tanto para compor a entrada quanto para reduzir o saldo devedor, além de pagar parte das prestações em situações previstas. O uso depende de o trabalhador ter conta vinculada, do enquadramento no programa e do imóvel financiado. Cada modalidade tem exigências próprias, então confirme as condições com o agente financeiro.',
    },
    { type: 'h2', text: 'Como participar' },
    {
      type: 'ol',
      items: [
        'Verifique em qual faixa a renda da sua família se encaixa, consultando a tabela vigente do programa.',
        'Procure empreendimentos cadastrados no programa, por meio de construtoras credenciadas ou do agente financeiro.',
        'Reúna documentação de renda, certidões e comprovação de que atende aos requisitos.',
        'Peça a simulação oficial com taxa, subsídio (quando houver), entrada e valor da prestação.',
        'Antes de assinar, confira o valor total, o custo efetivo e o comprometimento da renda.',
      ],
    },
    { type: 'h2', text: 'Cuidados' },
    {
      type: 'p',
      text: 'Unidades do programa costumam ter procura alta e podem envolver fila ou sorteio. Os parâmetros de renda, taxa e valor de imóvel mudam com o tempo, e o enquadramento depende da versão vigente quando você contrata. Simule com números atualizados e desconfie de promessas que fixem taxas ou subsídios fora das tabelas oficiais.',
    },
    {
      type: 'links',
      items: [
        { label: 'Descobrir qual imóvel cabe no meu bolso', href: '/qual-imovel-cabe-no-meu-bolso' },
        { label: 'Estimar os custos da compra', href: '/blog/quanto-preciso-para-comprar' },
        { label: 'Calcular quanto posso financiar', href: '/blog/quanto-posso-financiar' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'O subsídio precisa ser devolvido?' },
    {
      type: 'p',
      text: 'Nas faixas de menor renda, o subsídio é um desconto que reduz o valor financiado e não é devolvido, respeitadas as condições do programa. Já o valor financiado, sim, é pago normalmente ao banco.',
    },
    { type: 'h3', text: 'Posso usar o Minha Casa Minha Vida com imóvel usado?' },
    {
      type: 'p',
      text: 'O programa é voltado, em regra, a imóveis novos e a empreendimentos cadastrados, com variações conforme a versão vigente. Confirme as condições atuais com o agente financeiro.',
    },
    { type: 'h3', text: 'A taxa é a mesma para todo mundo?' },
    {
      type: 'p',
      text: 'Não. A taxa varia por faixa de renda e por modalidade, e pode mudar com atualizações do programa. Por isso a simulação oficial é indispensável.',
    },
  ],
  sources: [
    {
      label: 'Ministério das Cidades: Minha Casa Minha Vida',
      href: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/minha-casa-minha-vida',
    },
    {
      label: 'Caixa: Minha Casa Minha Vida',
      href: 'https://www.caixa.gov.br/voce/habitacao/minha-casa-minha-vida/Paginas/default.aspx',
    },
    {
      label: 'FGTS: uso do saldo em moradia',
      href: 'https://www.fgts.gov.br/',
    },
  ],
};

export default artigo;
