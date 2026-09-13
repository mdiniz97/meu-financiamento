CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asaas_payment_id" text NOT NULL,
	"subscription_id" uuid,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"billing_type" text,
	"due_date" timestamp with time zone,
	"value_cents" integer,
	"net_value_cents" integer,
	"invoice_url" text,
	"confirmed_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"raw_last_event" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asaas_event_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "webhook_events_asaas_event_id_unique" UNIQUE("asaas_event_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "asaas_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "asaas_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "asaas_checkout_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "billing_type" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cycle" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "asaas_status" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "card_last4" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "card_brand" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "grace_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_asaas_payment_id_unique" ON "payments" USING btree ("asaas_payment_id");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_events_event_idx" ON "webhook_events" USING btree ("event");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_asaas_subscription_id_unique" ON "subscriptions" USING btree ("asaas_subscription_id") WHERE "subscriptions"."asaas_subscription_id" IS NOT NULL;