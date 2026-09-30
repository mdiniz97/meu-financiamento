ALTER TABLE "subscriptions" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_offer_eligible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_offer_seen_at" timestamp with time zone;