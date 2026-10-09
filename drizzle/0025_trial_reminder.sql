CREATE TABLE "trial_reminder_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "state" text NOT NULL,
  "attempted_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone,
  "provider_message_id" text,
  CONSTRAINT "trial_reminder_deliveries_user_id_unique" UNIQUE("user_id")
);
