ALTER TABLE "movements" DROP CONSTRAINT "movements_state_id_contract_states_id_fk";
--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_state_id_contract_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."contract_states"("id") ON DELETE cascade ON UPDATE no action;