ALTER TABLE "sites" ALTER COLUMN "online_payment_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "online_payments_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "sites" SET "online_payment_enabled" = false;
