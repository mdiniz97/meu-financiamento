ALTER TABLE "contract_states" ADD COLUMN "dia_vencimento" integer;--> statement-breakpoint
UPDATE "contract_states" SET "dia_vencimento" = EXTRACT(DAY FROM "data_base"::date)::integer WHERE "dia_vencimento" IS NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "dia_vencimento" SET NOT NULL;
