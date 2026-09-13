CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_id" text NOT NULL,
	"provider" text NOT NULL,
	"asaas_checkout_id" text,
	"asaas_payment_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"credits" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asaas_invoice_id" text NOT NULL,
	"subscription_id" uuid,
	"user_id" uuid,
	"status" text NOT NULL,
	"number" text,
	"value_cents" integer,
	"pdf_url" text,
	"xml_url" text,
	"effective_date" timestamp with time zone,
	"raw_last_event" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_asaas_invoice_id_unique" UNIQUE("asaas_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "invoice_configured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_purchases_asaas_checkout_id_unique" ON "credit_purchases" USING btree ("asaas_checkout_id") WHERE "credit_purchases"."asaas_checkout_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_subscription_id_idx" ON "invoices" USING btree ("subscription_id");