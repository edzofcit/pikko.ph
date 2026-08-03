ALTER TABLE "merchants" ALTER COLUMN "monthly_court_price_cents" SET DEFAULT 59900;--> statement-breakpoint
UPDATE "merchants" SET "monthly_court_price_cents" = 59900 WHERE "monthly_court_price_cents" = 0 AND "subscription_status" = 'trialing';--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "trial_ends_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP + interval '14 days' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_subscriptions_merchant_period_uidx" ON "merchant_subscriptions" USING btree ("merchant_id","current_period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_merchant_period_uidx" ON "subscription_invoices" USING btree ("merchant_id","period_start");
