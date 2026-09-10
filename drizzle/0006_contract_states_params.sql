ALTER TABLE "contract_states" ADD COLUMN "bank" text;--> statement-breakpoint
ALTER TABLE "contract_states" ADD COLUMN "system" text;--> statement-breakpoint
ALTER TABLE "contract_states" ADD COLUMN "annual_rate" double precision;--> statement-breakpoint
ALTER TABLE "contract_states" ADD COLUMN "tr_monthly" double precision;--> statement-breakpoint
ALTER TABLE "contract_states" ADD COLUMN "insurance_monthly" double precision;--> statement-breakpoint
ALTER TABLE "contract_states" ADD COLUMN "parcelas_totais" integer;--> statement-breakpoint
UPDATE "contract_states" AS cs
SET "bank" = c."bank",
    "system" = c."system",
    "annual_rate" = c."annual_rate",
    "tr_monthly" = c."tr_monthly",
    "insurance_monthly" = c."insurance_monthly",
    "parcelas_totais" = c."parcelas_totais"
FROM "contracts" AS c
WHERE cs."contract_id" = c."id";--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "bank" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "system" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "annual_rate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "tr_monthly" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "insurance_monthly" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_states" ALTER COLUMN "parcelas_totais" SET NOT NULL;
