-- Dedupe legado: corridas antigas de primeira compra podem ter criado duas
-- linhas (user_id, pack_id, provider) com providerIds distintos. Mantém a
-- linha com o maior current_period_end (desempate: maior id) e apaga o resto.
-- subscriptions não tem dependentes (nenhuma tabela referencia ela), então a
-- remoção é segura; a assinatura duplicada perde apenas a linha redundante,
-- nunca dias já concedidos (a maior vigência sobrevive).
DELETE FROM "subscriptions" a
USING "subscriptions" b
WHERE a."id" <> b."id"
  AND a."user_id" = b."user_id"
  AND a."pack_id" = b."pack_id"
  AND a."provider" = b."provider"
  AND (
    COALESCE(a."current_period_end", 'epoch') < COALESCE(b."current_period_end", 'epoch')
    OR (
      a."current_period_end" IS NOT DISTINCT FROM b."current_period_end"
      AND a."id" < b."id"
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_pack_provider_unique" ON "subscriptions" USING btree ("user_id","pack_id","provider");
