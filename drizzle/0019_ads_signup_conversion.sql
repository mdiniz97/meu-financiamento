CREATE SEQUENCE IF NOT EXISTS "ads_signup_conversion_seq";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ads_signup_conversion_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ads_signup_claim_token" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ads_signup_claim_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ads_signup_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_ads_signup_conversion_id_unique" UNIQUE("ads_signup_conversion_id");
