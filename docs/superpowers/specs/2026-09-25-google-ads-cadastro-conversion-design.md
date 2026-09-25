# Conversão Google Ads após cadastro confirmado

## Objetivo e escopo

Medir **uma conversão por conta nova criada**, não por login, retorno do checkout,
pagamento ou renovação. A tag base `AW-18473946056` já está no layout global.
Enviar `gtag('event', 'conversion', ...)` apenas no navegador autenticado,
com `send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE'`, `value: 1.0`,
`currency: 'BRL'` e um `transaction_id` opaco exclusivo para a conta.
Valor é fixo, não representa preço nem receita. Sem e-mail, CPF, dados de
financiamento ou ID Asaas no evento.

Cadastro Google em produção e cadastro por e-mail, caso seja habilitado em
produção no futuro, usam a mesma regra de conta nova. Em desenvolvimento,
cadastro por e-mail não cria pendência nem envia evento. Usuários já
existentes não são convertidos retroativamente. A preferência de análise de
uso do site controla PostHog, não a tag de publicidade.

## Contexto e decisão

- Google OAuth cria `users` em `src/auth.ts` somente quando não há conta;
  login existente reaproveita `user.id`.
- Cadastro por e-mail cria `users` em `src/app/api/signup/route.ts`, quando
  habilitado. Ambos já criam bônus de boas-vindas.
- Webhooks Asaas confirmam pagamentos depois do checkout, mas deixam de ser
  relevantes à conversão de cadastro. Nenhuma alteração na máquina financeira.
- A tag base executa no navegador. O servidor não consegue chamar `gtag` no
  momento do INSERT; cliente pode fechar a página antes do retorno OAuth.

Escolha: **marca durável no registro de conta, com entrega idempotente por
reivindicação temporária e confirmação**. Alternativas rejeitadas: clique no
botão/retorno OAuth (conta login e pode perder entrega); importação server-side
Google Ads (outra integração, credenciais e vínculo de clique).

## Modelo e transições

Adicionar a `users` quatro campos anuláveis, sem default para contas antigas:

- `adsSignupConversionId`: texto opaco único, gerado no INSERT de conta nova
  em produção a partir de sequência de banco dedicada (`TID_<número da
  sequência>`). Índice único impede colisões. Não deriva de UUID, hash,
  e-mail ou dado pessoal. A sequência não preenche usuários antigos.
- `adsSignupClaimToken`: UUID temporário gerado pelo servidor.
- `adsSignupClaimUntil`: expiração da reserva temporária.
- `adsSignupSentAt`: confirmação de entrega, inicialmente nula.

Na criação de conta nova, preencher `adsSignupConversionId` no INSERT da
conta; no login existente, não alterar os campos. A marca deve nascer junto
da conta, sem um segundo INSERT que possa falhar depois do cadastro. Migração
é aditiva, aplicada pelo release step antes de aceitar tráfego. Falhas da
rede de publicidade não participam da transação de cadastro.

Estados: **sem marca** (conta antiga / ambiente não produção) → **pendente** →
**reservada por até cinco minutos** → **confirmada**. Reserva vencida volta
a ser elegível; confirmação não reabre. A unicidade por usuário e o ID estável
protegem contra recarga, múltiplas abas e retry; o Google Ads usa
`transaction_id` para deduplicar envios repetidos da mesma ação de conversão.

## APIs e navegador

`POST /api/ads/signup-conversion/claim`: autenticada, com verificação da
origem da requisição e resposta `no-store`. Um UPDATE condicional reserva a
pendência somente se ainda não confirmada e sem reserva válida. Responde
`{ transactionId, claimToken }` para a conta da sessão ou `204` sem pendência.
Não aceita `userId` do cliente.

`POST /api/ads/signup-conversion/ack`: autenticada, mesma origem, aceita
`claimToken` e confirma apenas reserva ativa da conta da sessão. Não aceita
ID de conta/compra fornecido pelo cliente. Chamadas repetidas são no-op.

Um Client Component no layout raiz tenta reivindicar após navegação/hidratação.
Espera de forma limitada a inicialização de `window.gtag` antes de reservar;
se a tag não estiver pronta, não reivindica nem confirma. Só então dispara:

```ts
gtag('event', 'conversion', {
  send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
  value: 1.0,
  currency: 'BRL',
  transaction_id: transactionId,
  event_callback: () => acknowledge(claimToken),
});
```

Sem callback (bloqueio/erro da tag), não confirma: a reserva expira e outra
visita autenticada pode tentar. Callback prova que a tag processou o comando,
**não** que Google Ads atribuiu uma conversão final à campanha. Falha de
Google/analytics não impede cadastro, login, créditos ou webhook. Evitar polling
contínuo: uma tentativa por navegação autenticada; não enviar se não há marca.

## Testes e aceitação

Testes: conta Google nova marcada; login existente não marcado; cadastro
por e-mail de desenvolvimento sem marca e, se habilitado em produção, com
marca; conta anterior à migração sem
conversão; claim concorrente entrega uma reserva; ack exige dono e token;
reserva vencida pode tentar novamente; reload e callback repetido não criam
outra conversão; script ausente não confirma. Testes de navegador interceptam
`gtag`/rede, sem enviar conversões reais ou fabricar pagamento.

No deploy, checar migração, rota autenticada, tag base e ausência de disparo
em login existente. Uma conversão real somente após cadastro real novo;
pagamento confirmado não entra nesse contador.

## Fontes

- Google Ads: [ID de transação e deduplicação](https://support.google.com/google-ads/answer/6386790?hl=pt-BR).
- [gtag.js API](https://developers.google.com/tag-platform/gtagjs/reference): `event` e callback.
- Asaas: `references/09-playbooks-saas.md` do projeto, seções de checkout e
  pagamento; retorno de checkout não confirma pagamento (fora do escopo aqui).
