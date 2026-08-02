ALTER TABLE "platform_settings" ADD COLUMN "maya_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maya_environment" varchar(16) DEFAULT 'sandbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maya_public_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maya_secret_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maya_public_key_last_four" varchar(4);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "maya_secret_key_last_four" varchar(4);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_maya_environment_valid" CHECK ("platform_settings"."maya_environment" in ('sandbox', 'production'));