CREATE TABLE "trial_followup_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_subscription_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"state" text NOT NULL,
	"attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trial_followup_stage_check" CHECK ("trial_followup_deliveries"."stage" IN ('day_1', 'day_7', 'day_30')),
	CONSTRAINT "trial_followup_state_check" CHECK ("trial_followup_deliveries"."state" IN ('attempted', 'sent', 'skipped', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "trial_followup_deliveries" ADD CONSTRAINT "trial_followup_deliveries_trial_subscription_id_subscriptions_id_fk" FOREIGN KEY ("trial_subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trial_followup_trial_stage_unique" ON "trial_followup_deliveries" USING btree ("trial_subscription_id","stage");