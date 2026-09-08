CREATE TABLE "contract_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"saldo_devedor" double precision NOT NULL,
	"data_base" text NOT NULL,
	"proxima_parcela_numero" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank" text NOT NULL,
	"system" text NOT NULL,
	"annual_rate" double precision NOT NULL,
	"tr_monthly" double precision NOT NULL,
	"insurance_monthly" double precision NOT NULL,
	"insurance_split" jsonb NOT NULL,
	"parcelas_totais" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"state_id" uuid NOT NULL,
	"type" text NOT NULL,
	"parcela_numero" integer,
	"valor" double precision NOT NULL,
	"data_pagamento" text NOT NULL,
	"origem" text,
	"modo" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_drafts" ADD CONSTRAINT "contract_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_states" ADD CONSTRAINT "contract_states_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_state_id_contract_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."contract_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_drafts_user_id_unique" ON "contract_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_states_contract_version_unique" ON "contract_states" USING btree ("contract_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_user_id_unique" ON "contracts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "movements_contract_parcela_unique" ON "movements" USING btree ("contract_id","parcela_numero") WHERE "movements"."type" = 'parcela' AND "movements"."parcela_numero" IS NOT NULL;