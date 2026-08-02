CREATE TABLE "booking_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_access_tokens" ADD CONSTRAINT "booking_access_tokens_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_access_tokens" ADD CONSTRAINT "booking_access_tokens_booking_tenant_fk" FOREIGN KEY ("merchant_id","booking_id") REFERENCES "public"."bookings"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_access_tokens_hash_uidx" ON "booking_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "booking_access_tokens_booking_idx" ON "booking_access_tokens" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_access_tokens_expiry_idx" ON "booking_access_tokens" USING btree ("expires_at");