CREATE TABLE "platform_settings" (
	"key" varchar(64) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_monthly_court_price_cents" integer DEFAULT 59900 NOT NULL,
	"default_gateway_fee_basis_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_monthly_price_nonnegative" CHECK ("platform_settings"."default_monthly_court_price_cents" >= 0),
	CONSTRAINT "platform_settings_gateway_fee_range" CHECK ("platform_settings"."default_gateway_fee_basis_points" between 0 and 10000)
);
