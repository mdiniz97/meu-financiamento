CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"awarded_at" timestamp with time zone,
	CONSTRAINT "referrals_invitee_id_unique" UNIQUE("invitee_id"),
	CONSTRAINT "referrals_state_check" CHECK ("referrals"."state" IN ('pending', 'awarded'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referrals_inviter_id_idx" ON "referrals" USING btree ("inviter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_referral_unique" ON "credit_ledger" USING btree ("user_id","description") WHERE "credit_ledger"."kind" = 'referral';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code");