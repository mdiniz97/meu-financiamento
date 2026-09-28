# Incentivo único de +2 créditos por e-mail

## Objetivo e públicos

Oferecer **mais dois créditos de simulação** uma única vez para contas que,
24 horas após o cadastro, **não estão com acesso Ilimitado ativo**. Isso se
soma aos cinco créditos concedidos no cadastro; não depende de compra ou Asaas.
Também avaliar contas anteriores ao lançamento em lotes graduais. Conta que
está Ilimitado no momento da avaliação fica permanentemente fora desta
campanha, mesmo se cancelar no futuro. Conta que assina após receber o e-mail
mantém seu link; créditos resgatados ficam no saldo para uso futuro.

Há dois textos conforme o histórico **salvo no banco** no momento do envio:

- Zero linhas em `simulations`: convite para conhecer o simulador e usar os
  créditos extras.
- Uma ou mais linhas: reconhecer que a pessoa já simulou e oferecer mais
  dois créditos para continuar explorando.

Simulações anônimas ou cálculos que não foram salvos não contam. Bônus e
mensagens não enviam valores, saldos ou dados de simulações ao provedor de
e-mail. Não haverá mais de um e-mail desta campanha por conta, qualquer que
seja o texto escolhido. A campanha é promocional: toda conta elegível entra
por padrão, com opção persistente de recusar ofertas. Boas-vindas, cobranças
e avisos operacionais não são afetados pela recusa.

## Diagnóstico de boas-vindas

O texto repetido não resulta de dois envios. `welcomeEmail` adiciona
`footerNote` com o motivo "ter criado uma conta"; o layout comum acrescenta
outra frase com o motivo "ter uma conta" no mesmo rodapé. Remover a linha
genérica do layout e manter
`footerNote` específico (boas-vindas e cobrança já o fornecem). Testar HTML
renderizado e versão em texto sem mudar o disparo de boas-vindas.

## Modelo e seleção atômica

Adicionar `users.activationBonusOptOutAt TIMESTAMPTZ NULL`. Nova tabela
`activation_bonus_offers`:

- `id UUID PRIMARY KEY`, `user_id UUID NOT NULL UNIQUE` com FK para `users`;
  unicidade por usuário é a guarda para esta campanha inteira.
- `state TEXT NOT NULL` em `attempted | skipped_unlimited`, `variant TEXT NULL`
  em `first_simulation | keep_exploring` para tentativas de envio.
- `token_hash TEXT UNIQUE NULL`, SHA-256 do token aleatório de 32 bytes; não
  guardar token em claro. Token nulo quando excluído por Ilimitado.
- `email_attempted_at TIMESTAMPTZ NULL`, `redeemed_at TIMESTAMPTZ NULL`,
  `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

Cron protegido por `CRON_SECRET` consulta usuários criados há pelo menos
24 horas, sem oferta anterior e sem recusa de ofertas. Um
`ACTIVATION_BONUS_START_AT` RFC3339 obrigatório, definido na ativação em
produção, separa contas novas (`created_at >= START_AT`) das históricas
(`created_at < START_AT`); sem essa configuração, cron não envia.
Cada rodada pega até **20 contas recém-elegíveis e 30 históricas**, evitando
que lote antigo atrase e-mail do dia seguinte. Escolha e INSERT com unicidade por
usuário arbitram execuções concorrentes. Revalidar elegibilidade, histórico de
simulação e Ilimitado imediatamente antes de reservar envio. Usar
`hasActiveAccess` para excluir assinatura ativa (inclusive carência ativa).
Se Ilimitado ativo, inserir `skipped_unlimited` sem token e nunca enviar.

Se `EMAIL_ENABLED`/configuração de envio não estiver pronta, não criar oferta
nem contar tentativa. Para elegível, gerar token, gravar digest/variante e
`email_attempted_at` **antes** do POST de e-mail. Depois chamar o provedor uma
vez. Falha de rede, resposta incerta, crash ou erro do provedor deixam a
tentativa registrada: não há retry automático, para cumprir prioridade de
**não mandar duas mensagens**. Uma falha pode deixar usuário sem oferta;
recuperação manual requer inspeção operacional, nunca reenvio cego. Tratar
supressão/desinscrição do provedor como não-entrega, sem retry automático.

## Link sem vencimento, privacidade e resgate

O link do e-mail contém token aleatório de 256 bits (`/resgatar/link?t=<token>`).
Não há TTL nem dependência de segredo rotativo. Um GET apenas valida formato,
coloca token em cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`, com
vida **de 15 minutos**, e responde `303` para `/resgatar` sem query string.
Esse GET **não resgata** crédito (pré-carregadores de e-mail não consomem
oferta). `Referrer-Policy: no-referrer` na resposta; assim scripts de
publicidade/analytics não recebem token na URL da página renderizada. Se
cookie expirar durante login, pessoa pode reabrir o mesmo link do e-mail.

Página limpa exige login e expõe botão explícito para resgatar. Ao fazer POST
com verificação de origem, o servidor toma token do cookie, calcula hash e
procura oferta **do `auth().userId`**. Hash encontrado para outra conta, token
inválido, ausência de cookie ou oferta excluída não concedem crédito nem
consomem link. Resposta genérica não revela quem é o destinatário. Dentro de
uma transação, UPDATE condicional `redeemed_at IS NULL` retorna a oferta
vencedora e, somente nesse caso, INSERT em `credit_ledger` com `amount=2`,
`kind='bonus'`, descrição estável ligada à oferta. Perda de conexão antes do
commit desfaz ambos; duas abas/POSTs concorrentes creditam uma vez. Bônus
resgatado não expira. Depois de usar, limpar cookie. Consulta autenticada
à oferta por usuário permite exibir "já resgatado" em visitas posteriores,
sem precisar do token.

Exemplo obrigatório: link enviado à conta A aberto enquanto conta B está
logada → conta B recebe **zero** créditos; oferta continua disponível para A
sem prazo de expiração. Nunca confiar em userId, e-mail ou valor trazido pelo
link/cliente. O app não registra token nem URL com query em logs; no go-live,
revisar logs de borda/origem, que podem capturar a URL antes do redirect.

## Preferências e texto dos e-mails

Adicionar escolha em `/perfil` para recusar/reativar e-mails promocionais,
persistida por rota autenticada com proteção de origem. E-mail de incentivo
inclui link para essa preferência e explicação de que é um bônus único de
ativação; não inclui detalhes financeiros. O controle não desativa mensagens
operacionais. Política de Privacidade/Cookies descreve comunicações de
ativação, a preferência e crédito resgatável. A resposta HTML usa o layout
institucional existente e a versão texto traz URL de resgate completa.

## Operação e testes

Rota `/api/cron/activation-bonus` segue padrão `isAuthorizedCronRequest`,
devolve contagens agregadas (elegíveis, tentados, pulados, falhas) sem tokens
ou PII. Provisionar cron Railway **separado** para rodar de hora em hora
(`0 * * * *`), após migração, env de e-mail validado e deploy do app. Não
aplicar patch Railway `function-bun` pendente sem autorização. Testar com
relógio injetado e provedor de e-mail mockado: 23h59 sem envio; 24h
elegível; backfill em lotes; variantes; Ilimitado; opt-out; cron concorrente;
falha incerta sem reenvio; token errado/conta B; resgate A único, duplo POST,
crédito exato e nenhum efeito no webhook/pagamentos. Nenhum envio real ou
criação de pagamento em testes.

## Limites explícitos

"Nunca duas vezes" significa que **o app faz no máximo uma chamada de envio
por conta nesta campanha**, priorizando at-most-once sobre entrega garantida.
O provedor/cliente de e-mail ainda controla a entrega final. "Validade
indeterminada" significa token utilizável até o resgate, mesmo depois de
meses, salvo eliminação da conta ou revogação operacional explícita.
