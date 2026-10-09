# Convite para ativar o trial em D+2

## Comportamento

- D+2 significa 48 horas completas desde `users.createdAt`.
- Cron horário: envio na primeira execução após completar 48h, até 100 contas por lote.
- Somente contas elegíveis criadas a partir de `TRIAL_REMINDER_START_AT`.
- Não envia para quem já usou trial, tem acesso pago, checkout pendente ou recusou ofertas.
- Não substitui a campanha de bônus de créditos nem o follow-up após fim do trial.
- Reserva única por usuário em `trial_reminder_deliveries`, com lock compartilhado com ativação.
- Atualiza `trialOfferEligibleAt` para reabrir 48h e limpa `trialOfferSeenAt` para exibir oferta.
- Não altera data de criação, créditos ou assinaturas. O teste começa apenas após confirmação no perfil.
- Ofertas que já tiveram reabertura explícita não recebem outra extensão pela campanha.
- Preferências e disponibilidade são conferidas novamente antes de enviar.
- Falha ou timeout fica registrado; não há reenvio automático após resultado incerto.
  A janela já concedida permanece disponível, sem ser estendida novamente.

## Publicação

1. Publicar código com migration `0025_trial_reminder`; o migrador de pre-deploy cria a tabela.
2. Configurar no serviço web `TRIAL_REMINDER_START_AT` com instante UTC real do lançamento.
   Vazio ou inválido desativa a campanha. Não usar data passada para importar a base histórica.
3. Conferir configuração existente de `EMAIL_ENABLED`, Resend, remetente e `APP_URL`.
4. Agendar `POST /api/cron/trial-reminder` a cada hora (`0 * * * *`), autenticado
   com `Authorization: Bearer $CRON_SECRET`. Seguir padrão de cron em `DEPLOY.md`.
5. Resposta contém apenas `sent`, `skipped`, `failed`; conferir HTTP 200 e contagens nos logs.

Criar endpoint não agenda o Railway automaticamente. Migration e configuração de produção
precisam estar aplicadas antes de habilitar o cron. Para suspender envios, esvaziar
`TRIAL_REMINDER_START_AT` ou pausar o job; isso não revoga ofertas já concedidas.

## Verificação local

Usar exclusivamente banco isolado `financiamento_trial_test`. Testes substituem transporte
de e-mail, preservando consultas, lock, concessão e ativação reais. Nenhum e-mail real é enviado.
