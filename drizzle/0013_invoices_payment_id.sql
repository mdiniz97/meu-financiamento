ALTER TABLE "invoices" ADD COLUMN "asaas_payment_id" text;--> statement-breakpoint
CREATE INDEX "invoices_asaas_payment_id_idx" ON "invoices" USING btree ("asaas_payment_id");