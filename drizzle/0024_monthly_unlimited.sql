ALTER TABLE "packs" ADD COLUMN "monthly_price_cents" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "asaas_checkout_link" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "checkout_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "contracted_price_cents" integer;--> statement-breakpoint
UPDATE "packs" SET "monthly_price_cents" = 1890 WHERE "id" = 'unlimited' AND "monthly_price_cents" IS NULL;
