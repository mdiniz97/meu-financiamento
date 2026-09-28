CREATE TABLE "activation_bonus_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"state" text NOT NULL,
	"variant" text,
	"token_hash" text,
	"email_attempted_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activation_bonus_offers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "activation_bonus_offers_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activation_bonus_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activation_bonus_offers" ADD CONSTRAINT "activation_bonus_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;