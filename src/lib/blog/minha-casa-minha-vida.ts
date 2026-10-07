import type { Article } from './types';

const artigo: Article = {
  slug: 'minha-casa-minha-vida',
  title: 'Minha Casa Minha Vida em 2026: faixas, taxas, subsídio e imóveis usados',
  description:
    'Confira faixas do Minha Casa Minha Vida em 2026, renda até R$ 13 mil, imóveis até R$ 600 mil na Faixa 4 (Classe Média), subsídios e regras para imóveis usados.',
  updatedAt: '2026-10-07',
  cta: { label: 'Descobrir qual imóvel cabe no meu bolso', href: '/qual-imovel-cabe-no-meu-bolso' },
  blocks: [
    {
      type: 'p',
      text: 'O Minha Casa Minha Vida é um programa habitacional do governo federal que facilita a compra da casa própria com juros abaixo do mercado e, para as rendas menores, subsídio que reduz o valor a financiar. Em vez de uma taxa única, o programa organiza as famílias por faixa de renda: quanto menor a renda, menor a taxa e maior o apoio.',
    },
    {
      type: 'p',
      text: 'Informações consultadas em 7 de outubro de 2026 nas páginas oficiais do Ministério das Cidades. Na linha financiada, o programa atende renda familiar mensal bruta de até R$ 13.000,00. Os limites dependem da modalidade e da localização; enquadramento não dispensa análise de crédito nem garante o subsídio máximo.',
    },
    { type: 'h2', text: 'Como funcionam as faixas' },
    {
      type: 'p',
      text: 'A tabela abaixo trata da linha financiada urbana, com renda mensal bruta da família. Não aplique esses limites à modalidade rural, que usa renda anual e regras próprias. A Faixa 4 (Classe Média) amplia o atendimento acima do teto da Faixa 3.',
    },
    {
      type: 'table',
      caption: 'Linha financiada urbana: parâmetros oficiais consultados em outubro de 2026',
      headers: ['Faixa', 'Renda familiar mensal bruta', 'Limite do imóvel'],
      rows: [
        ['Faixa 1', 'Até R$ 3.200,00', 'De R$ 210 mil a R$ 275 mil, conforme localização'],
        ['Faixa 2', 'De R$ 3.200,01 a R$ 5.000,00', 'De R$ 210 mil a R$ 275 mil, conforme localização'],
        ['Faixa 3', 'De R$ 5.000,01 a R$ 9.600,00', 'Até R$ 400 mil'],
        ['Faixa 4 (Classe Média)', 'Atendimento até R$ 13.000,00', 'Até R$ 600 mil'],
      ],
    },
    {
      type: 'p',
      text: 'Nas Faixas 1 e 2, o teto do imóvel muda por município. Na Faixa 3 e na Faixa 4 (Classe Média), os tetos indicados são nacionais. Estar dentro da renda e do preço é apenas uma parte da análise: o banco também verifica capacidade de pagamento, documentação e condições do imóvel.',
    },
    { type: 'h2', text: 'Subsídio e taxas reduzidas' },
    {
      type: 'p',
      text: 'Famílias com renda de até R$ 5.000,00 podem receber descontos na linha financiada de até R$ 65.000,00 na Região Norte e até R$ 55.000,00 nas demais regiões. São tetos, não valores automáticos. O cálculo considera renda e local de moradia; menor renda tende a receber maior desconto. Aportes públicos do MCMV Cidades podem complementar a operação.',
    },
    {
      type: 'table',
      caption: 'Taxas nominais anuais da linha financiada, sem confundir com CET',
      headers: ['Enquadramento', 'Referência oficial'],
      rows: [
        ['Faixa 1', 'De 4,00% a 5,25%, conforme renda, região e condição de cotista'],
        ['Faixa 2', 'De 4,75% a 7,00%, conforme renda, região e condição de cotista'],
        ['Faixa 3', '7,66% para cotistas; 8,16% para não cotistas'],
        ['Faixa 4 (Classe Média)', '10,00%'],
      ],
    },
    {
      type: 'p',
      text: 'O prazo máximo informado é de 420 meses, ou 35 anos. As taxas acima são nominais: seguros, tarifas e demais condições precisam ser conferidos na proposta e no CET. Não compare 10% nominais da Faixa 4 (Classe Média) diretamente com um exemplo de 10,5% efetivos ao ano sem converter a base.',
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
        'Quem não possui outro imóvel ou financiamento habitacional ativo, conforme os requisitos da linha financiada informados pelo Ministério.',
        'Quem não recebeu subsídio habitacional anterior em condições semelhantes, conforme as regras vigentes.',
        'Maiores de 18 anos ou emancipados, com documentação em ordem.',
      ],
    },
    { type: 'h2', text: 'O papel do FGTS' },
    {
      type: 'p',
      text: 'Não é necessário ter saldo de FGTS para acessar a linha financiada do MCMV. Ter acesso ao programa e poder usar o saldo são questões diferentes. Quando elegível, o trabalhador pode usar o FGTS na entrada, amortização, liquidação ou pagamento de parte das prestações, respeitando as regras de cada modalidade. O Pró-Cotista é uma linha distinta e exige condição de cotista.',
    },
    { type: 'h2', text: 'Imóvel usado e entrada: atenção à cota financiada' },
    {
      type: 'p',
      text: 'A linha financiada admite imóveis novos, em construção e usados, além de construção em terreno próprio ou compra de terreno com construção. Não exige que toda compra seja em empreendimento de uma construtora cadastrada. O imóvel escolhido precisa passar pela avaliação e pelo enquadramento do banco.',
    },
    {
      type: 'table',
      caption: 'Faixa 4 (Classe Média): cotas máximas divulgadas pelo Ministério das Cidades',
      headers: ['Situação', 'Cota máxima', 'Parte não financiada'],
      rows: [
        ['Usado no Sul ou Sudeste', '60%', 'Pelo menos 40%'],
        ['Novo, ou usado nas demais regiões, em PRICE', '80%', 'Pelo menos 20%'],
        ['Novo, ou usado nas demais regiões, em SAC', '90%', 'Pelo menos 10%'],
      ],
    },
    {
      type: 'p',
      text: 'Essas cotas são da Faixa 4 (Classe Média), não uma regra única para todas as faixas. Para um usado de R$ 500 mil no Sudeste, a cota de 60% permite no máximo R$ 300 mil financiados: os R$ 200 mil restantes, mais despesas de compra, precisam ser cobertos por recursos elegíveis. A aprovação por renda pode reduzir ainda mais o financiamento.',
    },
    { type: 'h2', text: 'Como participar' },
    {
      type: 'ol',
      items: [
        'Verifique em qual faixa a renda da sua família se encaixa, consultando a tabela vigente do programa.',
        'Na linha financiada, escolha um imóvel elegível e procure Caixa ou Banco do Brasil para análise de crédito. Não há inscrição nem processo seletivo nessa linha.',
        'Reúna documentação de renda, certidões e comprovação de que atende aos requisitos.',
        'Peça a simulação oficial com taxa, subsídio (quando houver), entrada e valor da prestação.',
        'Antes de assinar, confira o valor total, o custo efetivo e o comprometimento da renda.',
      ],
    },
    { type: 'h2', text: 'Cuidados' },
    {
      type: 'p',
      text: 'Não confunda modalidades: a linha subsidiada da Faixa 1 pode envolver cadastro na prefeitura ou entidade organizadora e critérios de seleção. A linha financiada é contratada diretamente com o banco e não tem sorteio. O Ministério proíbe taxas de cadastramento e de priorização de beneficiários. Verifique os parâmetros na proposta, pois podem mudar depois da consulta deste artigo.',
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
      text: 'Sim. A linha financiada admite usados, desde que o imóvel e a operação sejam elegíveis. Na Faixa 4 (Classe Média), usados no Sul e Sudeste têm cota máxima de 60%; a entrada é, portanto, maior. As condições de outras faixas devem ser verificadas na simulação oficial.',
    },
    { type: 'h3', text: 'A taxa é a mesma para todo mundo?' },
    {
      type: 'p',
      text: 'Não. A taxa varia por faixa de renda e por modalidade, e pode mudar com atualizações do programa. Por isso a simulação oficial é indispensável.',
    },
  ],
  sources: [
    {
      label: 'Ministério das Cidades: linha financiada, faixas, taxas e subsídios (consulta em 07/10/2026)',
      href: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/mcmv-fgts',
    },
    {
      label: 'Ministério das Cidades: Faixa 4 (Classe Média), imóveis usados e cotas de financiamento (consulta em 07/10/2026)',
      href: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida/minha-casa-minha-vida-classe-media/minha-casa-minha-vida-classe-media-1',
    },
    {
      label: 'Ministério das Cidades: modalidades e proibição de taxas de cadastro',
      href: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/habitacao/programa-minha-casa-minha-vida',
    },
  ],
};

export default artigo;
