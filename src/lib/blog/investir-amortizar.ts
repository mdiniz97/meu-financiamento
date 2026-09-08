import type { Article } from './types';

const artigo: Article = {
  slug: 'selic-alta-investir-ou-amortizar',
  title: 'Selic alta: vale investir ou amortizar o financiamento?',
  description:
    'Compare rendimento líquido, juros do contrato, liquidez e riscos antes de investir ou amortizar. Veja um exemplo de dois anos e um checklist para decidir.',
  updatedAt: '2026-09-08',
  cta: { label: 'Comparar meu caso', href: '/investir-ou-amortizar' },
  blocks: [
    {
      type: 'p',
      text: 'Uma Selic elevada pode tornar alguns investimentos mais atraentes, mas não resolve sozinha a escolha entre aplicar e amortizar o financiamento. A comparação começa pelo rendimento depois dos impostos e custos, passa pelos juros do contrato e termina numa pergunta prática: você pode abrir mão desse dinheiro agora?',
    },
    {
      type: 'p',
      text: 'Se a quantia sustenta sua reserva ou uma despesa próxima, preservar liquidez pode importar mais que uma pequena vantagem de taxa. Se é uma sobra disponível por bastante tempo, vale simular os dois caminhos com o mesmo orçamento e horizonte.',
    },
    { type: 'h2', text: 'O que você ganha ao amortizar' },
    {
      type: 'p',
      text: 'Amortizar significa abater o principal da dívida. Com menos saldo devedor, diminui a base sobre a qual incidem os juros futuros. O benefício aparece como despesas evitadas e mudanças no cronograma, não como rendimento depositado em uma conta que você possa resgatar.',
    },
    {
      type: 'p',
      text: 'Por isso, chamar amortização de retorno garantido igual à taxa do contrato simplifica demais. A economia depende do saldo, das datas, do sistema de amortização, do indexador e da opção entre reduzir prazo ou prestação. Use o CET para entender a composição dos custos, mas não suponha que toda despesa incluída nele será eliminada pelo aporte.',
    },
    { type: 'h2', text: 'Renda fixa não é sinônimo de Selic' },
    {
      type: 'p',
      text: 'Renda fixa significa conhecer a regra de remuneração, não necessariamente o valor final. Antes de comparar, identifique exatamente o produto:',
    },
    {
      type: 'ul',
      items: [
        'Prefixado: tem taxa definida na contratação, com resultado contratado associado às condições e ao vencimento.',
        'Pós-fixado: acompanha um referencial. Um CDB pode pagar um percentual do CDI; o Tesouro Selic acompanha a Selic.',
        'Híbrido: combina uma parcela fixa com um índice, como o IPCA. Sua remuneração não equivale automaticamente à Selic.',
      ],
    },
    {
      type: 'p',
      text: 'Taxa anunciada, prazo, carência e possibilidade de venda antecipada precisam entrar juntos na análise. Não atribua a toda renda fixa o rendimento de um único título.',
    },
    { type: 'h2', text: 'Compare o líquido depois dos impostos' },
    {
      type: 'p',
      text: 'Em aplicações tributadas como CDB e Tesouro Direto, o IR incide sobre o rendimento, não sobre todo o dinheiro resgatado. A tabela regressiva depende do tempo da aplicação:',
    },
    {
      type: 'table',
      caption: 'IR sobre rendimentos de aplicações sujeitas à tabela regressiva de renda fixa',
      headers: ['Prazo da aplicação', 'Alíquota de IR'],
      rows: [
        ['Até 180 dias', '22,5%'],
        ['De 181 a 360 dias', '20%'],
        ['De 361 a 720 dias', '17,5%'],
        ['Acima de 720 dias', '15%'],
      ],
    },
    {
      type: 'p',
      text: 'A alíquota de 15% só se aplica acima de 720 dias. Aportes feitos em datas diferentes formam lotes com prazos próprios: um investimento antigo não torna automaticamente antigo o dinheiro aplicado ontem. No Tesouro, a contagem considera as datas de liquidação.',
    },
    {
      type: 'p',
      text: 'Resgates em menos de 30 dias também podem ter IOF sobre o rendimento, nas aplicações sujeitas a essa cobrança. Inclua eventuais taxas e custódia. Não generalize o IR: LCI e LCA têm isenção para pessoas físicas, conforme seu regime, mas ainda exigem análise de prazo, liquidez e risco.',
    },
    { type: 'h2', text: 'Exemplo: R$ 100 mil durante dois anos' },
    {
      type: 'p',
      text: 'Considere um único aporte de R$ 100.000,00, mantido por dois anos completos, portanto mais de 720 dias. Suponha rendimento bruto efetivo de 12% ao ano, constante apenas para este exercício, com capitalização composta. Não há retiradas, novos aportes, taxas ou cupons; o IR de 15% é cobrado somente no resgate final. Não há IOF nesse prazo.',
    },
    {
      type: 'table',
      caption: 'Investimento hipotético com tributação apenas no final de dois anos',
      headers: ['Etapa', 'Cálculo e resultado'],
      rows: [
        ['Montante bruto', 'R$ 100.000,00 multiplicados por 1,12 duas vezes: R$ 125.440,00'],
        ['Ganho bruto', 'R$ 125.440,00 menos R$ 100.000,00: R$ 25.440,00'],
        ['IR sobre o ganho', '15% de R$ 25.440,00: R$ 3.816,00'],
        ['Montante líquido', 'R$ 125.440,00 menos R$ 3.816,00: R$ 121.624,00'],
        ['Taxa líquida anual equivalente', 'Raiz quadrada de 1,21624, menos 1: aproximadamente 10,28% ao ano'],
      ],
    },
    {
      type: 'p',
      text: 'Diante de juros contratuais de 10,5% efetivos ao ano, os 10,28% líquidos ficam abaixo numa primeira triagem. Isso não calcula quanto seu financiamento economizaria: o saldo muda com as prestações, e reduzir prazo ou prestação altera os fluxos. A decisão exige simular o contrato, não tratar a dívida como dinheiro aplicado por dois anos.',
    },
    {
      type: 'note',
      text: 'O exemplo é uma hipótese, não uma previsão da Selic ou promessa de rentabilidade. Multiplicar 12% por 85% dá 10,2% numa aproximação de rendimento simples, mas não substitui a taxa anual equivalente deste cenário composto de dois anos.',
    },
    { type: 'h2', text: 'Liquidez e reserva também têm valor' },
    {
      type: 'p',
      text: 'Depois de amortizar, você não pode pedir de volta o aporte como faria com um investimento resgatável. Uma emergência pode exigir outro crédito, possivelmente mais caro. Dimensione a reserva conforme despesas essenciais, estabilidade da renda, dependentes e riscos da família; não existe um número de meses adequado a todos.',
    },
    {
      type: 'p',
      text: 'A CVM orienta priorizar baixo risco e alta liquidez na reserva. Mesmo no Tesouro Selic, liquidez diária não significa saque instantâneo a qualquer hora. Resgates seguem horários e dias úteis, são feitos a preço de mercado e podem enfrentar suspensão temporária das negociações. Confira também quando a instituição disponibiliza o dinheiro.',
    },
    { type: 'h2', text: 'Avalie riscos e horizonte' },
    {
      type: 'ul',
      items: [
        'Risco de crédito: o emissor pode deixar de cumprir suas obrigações. Avalie quem deve pagar e quais proteções se aplicam.',
        'Risco de mercado: preços oscilam. Uma venda antes do vencimento pode produzir resultado diferente do esperado, inclusive na renda fixa.',
        'Risco de liquidez: carência, prazos operacionais ou dificuldade de venda podem impedir o acesso ao dinheiro quando necessário.',
      ],
    },
    {
      type: 'p',
      text: 'O horizonte muda a conta. Um pós-fixado pode render menos se seu indexador cair; um título que vence antes da meta exige reinvestimento em condições ainda desconhecidas. Teste cenários de rendimento menor, custos maiores e necessidade de resgate. Uma diferença pequena de taxa não elimina esses riscos.',
    },
    { type: 'h2', text: 'Checklist antes de escolher' },
    {
      type: 'ol',
      items: [
        'Separe a reserva e as despesas previstas. Compare apenas o excedente disponível.',
        'Obtenha saldo atualizado, prazo restante, sistema, taxa efetiva e indexador do financiamento.',
        'Identifique rendimento, tributação por lote, custos, vencimento e regras de saída do investimento.',
        'Simule amortização com redução de prazo e com redução de prestação, usando a mesma data de aporte.',
        'Compare o patrimônio líquido no mesmo horizonte: investimentos menos dívida restante, com os mesmos recursos iniciais e mensais.',
        'Defina o destino das prestações liberadas ou reduzidas. Não conte como investido um dinheiro que será gasto.',
      ],
    },
    {
      type: 'p',
      text: 'Não precisa ser tudo ou nada. Preservar uma parte líquida e amortizar outra pode equilibrar segurança e redução da dívida. A divisão deve responder ao orçamento e aos objetivos, não a um percentual escolhido sem simulação.',
    },
    { type: 'h2', text: 'Como comparar seu caso' },
    {
      type: 'p',
      text: 'O comparador do amortiza.me exige login e Plano Ilimitado e explora três estratégias: reduzir prestação, reduzir prazo e manter o principal investido, usando o rendimento líquido mensal para amortizar. Seu ranking considera a economia de juros até a quitação, não o patrimônio líquido ao final de um horizonte comum. Ele não reproduz o exemplo acima, em que todo rendimento permanece aplicado por dois anos. Confira as premissas de cada estratégia e não interprete o ranking como recomendação definitiva entre investir e quitar. Para executar a amortização, solicite a simulação oficial do contrato.',
    },
    {
      type: 'links',
      items: [
        { label: 'Comparar meu caso', href: '/investir-ou-amortizar' },
        { label: 'Entender juros efetivos e CET', href: '/blog/juros-do-financiamento' },
        { label: 'Planejar aportes para quitar antes', href: '/blog/quitar-financiamento-antes' },
      ],
    },
    { type: 'h2', text: 'Perguntas frequentes' },
    { type: 'h3', text: 'Se o rendimento líquido for maior, investir sempre vence?' },
    {
      type: 'p',
      text: 'Não automaticamente. A vantagem precisa sobreviver aos riscos, ao prazo e aos fluxos reais. Também é necessário manter disciplina para não gastar o capital reservado enquanto a dívida continua sendo paga.',
    },
    { type: 'h3', text: 'Reduzir a prestação é pior que reduzir o prazo?' },
    {
      type: 'p',
      text: 'São objetivos distintos. Reduzir prazo antecipa o fim da dívida; reduzir prestação alivia o compromisso mensal. Compare a economia e o destino da folga no orçamento, sem presumir que ela será reinvestida.',
    },
    { type: 'h3', text: 'Posso tratar meu FGTS como dinheiro disponível para investir?' },
    {
      type: 'p',
      text: 'Não enquanto o saldo estiver vinculado e sem hipótese de saque aplicável. O uso habitacional depende do enquadramento do trabalhador, imóvel e contrato. Analise essa possibilidade separadamente dos recursos livres e confirme condições com o agente financeiro.',
    },
  ],
  sources: [
    {
      label: 'Receita Federal: tributação de 2026 e rendimentos de capital',
      href: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026',
    },
    {
      label: 'Tesouro Direto: regras, tributação, liquidação e resgate a mercado',
      href: 'https://www.tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento',
    },
    {
      label: 'CVM: características dos investimentos, riscos, liquidez e reserva',
      href: 'https://www.gov.br/investidor/pt-br/investir/antes-de-investir/entenda-as-caracteristicas-dos-investimentos',
    },
    {
      label: 'CVM: títulos bancários, tributação de CDB, LCI e LCA',
      href: 'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos/titulos-bancarios',
    },
  ],
};

export default artigo;
