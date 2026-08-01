CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
CREATE TYPE "public"."court_allocation_kind" AS ENUM('checkout_hold', 'booking', 'merchant_block');--> statement-breakpoint
CREATE TYPE "public"."court_block_type" AS ENUM('maintenance', 'private_event', 'temporary_closure');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('customer_web', 'merchant_walk_in', 'merchant_phone', 'merchant_complimentary');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('draft', 'pending_payment', 'pending_verification', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."checkout_hold_status" AS ENUM('active', 'converted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."court_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'past_due', 'void');--> statement-breakpoint
CREATE TYPE "public"."manual_proof_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."manual_reservation_mode" AS ENUM('reserve_immediately', 'reserve_after_verification');--> statement-breakpoint
CREATE TYPE "public"."merchant_role" AS ENUM('owner', 'site_manager', 'booking_staff', 'cashier', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('onboarding', 'active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('maya_qrph', 'manual_bank_transfer', 'manual_ewallet', 'cash', 'complimentary');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('maya', 'manual', 'none');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending', 'paid', 'rejected', 'failed', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."price_rule_type" AS ENUM('recurring', 'special_date', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('draft', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"price_rule_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_items_valid_period" CHECK ("booking_items"."starts_at" < "booking_items"."ends_at"),
	CONSTRAINT "booking_items_amounts_nonnegative" CHECK ("booking_items"."hourly_rate_cents" >= 0 and "booking_items"."line_total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"customer_id" uuid,
	"reference" varchar(32) NOT NULL,
	"source" "booking_source" NOT NULL,
	"status" "booking_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"customer_name" varchar(160),
	"customer_email" varchar(320),
	"customer_mobile_number" varchar(40),
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"merchant_fee_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"promo_code_id" uuid,
	"cancellation_policy_id" uuid,
	"policy_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_notes" text,
	"internal_notes" text,
	"payment_due_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancellation_reason" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_merchant_id_id_key" UNIQUE("merchant_id","id"),
	CONSTRAINT "bookings_amounts_nonnegative" CHECK ("bookings"."subtotal_cents" >= 0 and "bookings"."discount_cents" >= 0 and "bookings"."tax_cents" >= 0 and "bookings"."merchant_fee_cents" >= 0 and "bookings"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkout_hold_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"hold_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"quoted_rate_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_hold_items_valid_period" CHECK ("checkout_hold_items"."starts_at" < "checkout_hold_items"."ends_at"),
	CONSTRAINT "checkout_hold_items_rate_nonnegative" CHECK ("checkout_hold_items"."quoted_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "checkout_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"status" "checkout_hold_status" DEFAULT 'active' NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"quoted_total_cents" integer NOT NULL,
	"pricing_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_holds_total_nonnegative" CHECK ("checkout_holds"."quoted_total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "court_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"kind" "court_allocation_kind" NOT NULL,
	"booking_item_id" uuid,
	"checkout_hold_item_id" uuid,
	"court_block_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "court_allocations_valid_period" CHECK ("court_allocations"."starts_at" < "court_allocations"."ends_at"),
	CONSTRAINT "court_allocations_exactly_one_source" CHECK (num_nonnulls("court_allocations"."booking_item_id", "court_allocations"."checkout_hold_item_id", "court_allocations"."court_block_id") = 1),
	CONSTRAINT "court_allocations_kind_matches_source" CHECK (("court_allocations"."kind" = 'booking' and "court_allocations"."booking_item_id" is not null) or ("court_allocations"."kind" = 'checkout_hold' and "court_allocations"."checkout_hold_item_id" is not null) or ("court_allocations"."kind" = 'merchant_block' and "court_allocations"."court_block_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"mobile_number" varchar(40),
	"marketing_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"maximum_discount_cents" integer,
	"minimum_spend_cents" integer DEFAULT 0 NOT NULL,
	"redemption_limit" integer,
	"per_customer_limit" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_value_positive" CHECK ("promo_codes"."discount_value" > 0),
	CONSTRAINT "promo_codes_minimum_nonnegative" CHECK ("promo_codes"."minimum_spend_cents" >= 0),
	CONSTRAINT "promo_codes_percentage_range" CHECK ("promo_codes"."discount_type" <> 'percentage' or "promo_codes"."discount_value" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid,
	"customer_email" varchar(320) NOT NULL,
	"discount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_redemptions_discount_nonnegative" CHECK ("promo_redemptions"."discount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "merchant_role" NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"legal_name" varchar(200),
	"slug" varchar(100) NOT NULL,
	"status" "merchant_status" DEFAULT 'onboarding' NOT NULL,
	"default_timezone" varchar(64) DEFAULT 'Asia/Manila' NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(40),
	"logo_url" text,
	"subscription_status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"monthly_court_price_cents" integer DEFAULT 0 NOT NULL,
	"gateway_fee_basis_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_monthly_court_price_nonnegative" CHECK ("merchants"."monthly_court_price_cents" >= 0),
	CONSTRAINT "merchants_gateway_fee_basis_points_range" CHECK ("merchants"."gateway_fee_basis_points" >= 0 and "merchants"."gateway_fee_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"mobile_number" varchar(40),
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_signed_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" "manual_proof_status" DEFAULT 'submitted' NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"customer_notes" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_payment_proofs_size_positive" CHECK ("manual_payment_proofs"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_event_id" varchar(200),
	"event_type" varchar(120) NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"request_reference" varchar(100) NOT NULL,
	"provider_payment_id" varchar(160),
	"provider_reference" varchar(160),
	"provider_status" varchar(80),
	"gateway_fee_basis_points" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_code" varchar(100),
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_nonnegative" CHECK ("payments"."amount_cents" >= 0),
	CONSTRAINT "payments_platform_fee_nonnegative" CHECK ("payments"."platform_fee_cents" >= 0),
	CONSTRAINT "payments_gateway_fee_range" CHECK ("payments"."gateway_fee_basis_points" >= 0 and "payments"."gateway_fee_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"provider_refund_id" varchar(160),
	"reason" text NOT NULL,
	"requested_by_user_id" uuid,
	"processed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(160) NOT NULL,
	"target_type" varchar(100) NOT NULL,
	"target_id" uuid,
	"booking_id" uuid,
	"source_ip" varchar(64),
	"user_agent" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_subscription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"billable" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "court_subscription_usage_billable_boolean" CHECK ("court_subscription_usage"."billable" in (0, 1)),
	CONSTRAINT "court_subscription_usage_price_nonnegative" CHECK ("court_subscription_usage"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"monthly_court_price_cents" integer NOT NULL,
	"current_period_start" date NOT NULL,
	"current_period_end" date NOT NULL,
	"grace_period_days" integer DEFAULT 7 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_subscriptions_price_nonnegative" CHECK ("merchant_subscriptions"."monthly_court_price_cents" >= 0),
	CONSTRAINT "merchant_subscriptions_valid_period" CHECK ("merchant_subscriptions"."current_period_start" < "merchant_subscriptions"."current_period_end")
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"invoice_number" varchar(40) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"court_count" integer NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_invoices_court_count_nonnegative" CHECK ("subscription_invoices"."court_count" >= 0),
	CONSTRAINT "subscription_invoices_amounts_nonnegative" CHECK ("subscription_invoices"."subtotal_cents" >= 0 and "subscription_invoices"."tax_cents" >= 0 and "subscription_invoices"."total_cents" >= 0),
	CONSTRAINT "subscription_invoices_valid_period" CHECK ("subscription_invoices"."period_start" < "subscription_invoices"."period_end")
);
--> statement-breakpoint
CREATE TABLE "cancellation_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"customer_cancellation_enabled" boolean DEFAULT true NOT NULL,
	"self_service_cutoff_minutes" integer DEFAULT 360 NOT NULL,
	"no_show_grace_minutes" integer DEFAULT 15 NOT NULL,
	"refund_tax" boolean DEFAULT true NOT NULL,
	"refund_merchant_fees" boolean DEFAULT false NOT NULL,
	"refund_gateway_fees" boolean DEFAULT false NOT NULL,
	"customer_visible_text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cancellation_policies_cutoff_nonnegative" CHECK ("cancellation_policies"."self_service_cutoff_minutes" >= 0),
	CONSTRAINT "cancellation_policies_grace_nonnegative" CHECK ("cancellation_policies"."no_show_grace_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cancellation_policy_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"minimum_minutes_before_start" integer NOT NULL,
	"refund_basis_points" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cancellation_policy_tiers_minutes_nonnegative" CHECK ("cancellation_policy_tiers"."minimum_minutes_before_start" >= 0),
	CONSTRAINT "cancellation_policy_tiers_refund_range" CHECK ("cancellation_policy_tiers"."refund_basis_points" >= 0 and "cancellation_policy_tiers"."refund_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "court_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"type" "court_block_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"customer_visible" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "court_blocks_valid_period" CHECK ("court_blocks"."starts_at" < "court_blocks"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "court_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "court_operating_hours_day_range" CHECK ("court_operating_hours"."day_of_week" between 0 and 6),
	CONSTRAINT "court_operating_hours_valid_period" CHECK ("court_operating_hours"."opens_at" < "court_operating_hours"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"status" "court_status" DEFAULT 'active' NOT NULL,
	"base_hourly_rate_cents" integer NOT NULL,
	"surface_type" varchar(100),
	"indoor" boolean DEFAULT false NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courts_merchant_id_id_key" UNIQUE("merchant_id","id"),
	CONSTRAINT "courts_base_hourly_rate_nonnegative" CHECK ("courts"."base_hourly_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_site_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"court_id" uuid,
	"name" varchar(160) NOT NULL,
	"type" "price_rule_type" NOT NULL,
	"day_of_week" integer,
	"special_date" date,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"active_from" date,
	"active_until" date,
	"hourly_rate_cents" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rules_valid_period" CHECK ("price_rules"."starts_at" < "price_rules"."ends_at"),
	CONSTRAINT "price_rules_rate_nonnegative" CHECK ("price_rules"."hourly_rate_cents" >= 0),
	CONSTRAINT "price_rules_day_range" CHECK ("price_rules"."day_of_week" is null or "price_rules"."day_of_week" between 0 and 6),
	CONSTRAINT "price_rules_type_fields" CHECK (("price_rules"."type" = 'recurring' and "price_rules"."day_of_week" is not null and "price_rules"."special_date" is null) or ("price_rules"."type" = 'special_date' and "price_rules"."special_date" is not null) or ("price_rules"."type" = 'seasonal' and "price_rules"."active_from" is not null and "price_rules"."active_until" is not null))
);
--> statement-breakpoint
CREATE TABLE "schedule_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"court_id" uuid,
	"local_date" date NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"label" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_overrides_valid_period" CHECK ("schedule_overrides"."is_closed" or ("schedule_overrides"."opens_at" is not null and "schedule_overrides"."closes_at" is not null and "schedule_overrides"."opens_at" < "schedule_overrides"."closes_at"))
);
--> statement-breakpoint
CREATE TABLE "site_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_operating_hours_day_range" CHECK ("site_operating_hours"."day_of_week" between 0 and 6),
	CONSTRAINT "site_operating_hours_valid_period" CHECK ("site_operating_hours"."opens_at" < "site_operating_hours"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"address_line_1" varchar(200) NOT NULL,
	"address_line_2" varchar(200),
	"city" varchar(100) NOT NULL,
	"province" varchar(100),
	"postal_code" varchar(20),
	"country_code" varchar(2) DEFAULT 'PH' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"timezone" varchar(64) DEFAULT 'Asia/Manila' NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(40),
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"booking_lead_minutes" integer DEFAULT 60 NOT NULL,
	"advance_booking_days" integer DEFAULT 30 NOT NULL,
	"online_payment_enabled" boolean DEFAULT true NOT NULL,
	"manual_payment_enabled" boolean DEFAULT false NOT NULL,
	"manual_reservation_mode" "manual_reservation_mode" DEFAULT 'reserve_immediately' NOT NULL,
	"manual_payment_deadline_minutes" integer DEFAULT 30 NOT NULL,
	"manual_payment_instructions" text,
	"manual_payment_qr_url" text,
	"tax_inclusive" boolean DEFAULT true NOT NULL,
	"tax_basis_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_merchant_id_id_key" UNIQUE("merchant_id","id"),
	CONSTRAINT "sites_booking_lead_nonnegative" CHECK ("sites"."booking_lead_minutes" >= 0),
	CONSTRAINT "sites_advance_days_positive" CHECK ("sites"."advance_booking_days" > 0),
	CONSTRAINT "sites_manual_deadline_positive" CHECK ("sites"."manual_payment_deadline_minutes" > 0),
	CONSTRAINT "sites_tax_basis_points_range" CHECK ("sites"."tax_basis_points" >= 0 and "sites"."tax_basis_points" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_tenant_fk" FOREIGN KEY ("merchant_id","booking_id") REFERENCES "public"."bookings"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancellation_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("cancellation_policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold_items" ADD CONSTRAINT "checkout_hold_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold_items" ADD CONSTRAINT "checkout_hold_items_hold_id_checkout_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."checkout_holds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_hold_items" ADD CONSTRAINT "checkout_hold_items_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_holds" ADD CONSTRAINT "checkout_holds_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_holds" ADD CONSTRAINT "checkout_holds_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_booking_item_id_booking_items_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_checkout_hold_item_id_checkout_hold_items_id_fk" FOREIGN KEY ("checkout_hold_item_id") REFERENCES "public"."checkout_hold_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_court_block_id_court_blocks_id_fk" FOREIGN KEY ("court_block_id") REFERENCES "public"."court_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_booking_tenant_fk" FOREIGN KEY ("merchant_id","booking_id") REFERENCES "public"."bookings"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_memberships" ADD CONSTRAINT "merchant_memberships_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_memberships" ADD CONSTRAINT "merchant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_memberships" ADD CONSTRAINT "merchant_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_proofs" ADD CONSTRAINT "manual_payment_proofs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_proofs" ADD CONSTRAINT "manual_payment_proofs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_proofs" ADD CONSTRAINT "manual_payment_proofs_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_proofs" ADD CONSTRAINT "manual_payment_proofs_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_subscription_usage" ADD CONSTRAINT "court_subscription_usage_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_subscription_usage" ADD CONSTRAINT "court_subscription_usage_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_subscriptions" ADD CONSTRAINT "merchant_subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_policy_tiers" ADD CONSTRAINT "cancellation_policy_tiers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_policy_tiers" ADD CONSTRAINT "cancellation_policy_tiers_policy_id_cancellation_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_blocks" ADD CONSTRAINT "court_blocks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_blocks" ADD CONSTRAINT "court_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_blocks" ADD CONSTRAINT "court_blocks_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_operating_hours" ADD CONSTRAINT "court_operating_hours_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_operating_hours" ADD CONSTRAINT "court_operating_hours_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_site_assignments" ADD CONSTRAINT "merchant_site_assignments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_site_assignments" ADD CONSTRAINT "merchant_site_assignments_membership_id_merchant_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."merchant_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_site_assignments" ADD CONSTRAINT "merchant_site_assignments_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_operating_hours" ADD CONSTRAINT "site_operating_hours_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_operating_hours" ADD CONSTRAINT "site_operating_hours_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_booking_court_start_uidx" ON "booking_items" USING btree ("booking_id","court_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_items_court_period_idx" ON "booking_items" USING btree ("court_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_uidx" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "bookings_merchant_site_created_idx" ON "bookings" USING btree ("merchant_id","site_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_merchant_status_idx" ON "bookings" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_hold_items_hold_court_start_uidx" ON "checkout_hold_items" USING btree ("hold_id","court_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_holds_token_hash_uidx" ON "checkout_holds" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "checkout_holds_status_expiry_idx" ON "checkout_holds" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "court_allocations_booking_item_uidx" ON "court_allocations" USING btree ("booking_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "court_allocations_hold_item_uidx" ON "court_allocations" USING btree ("checkout_hold_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "court_allocations_block_uidx" ON "court_allocations" USING btree ("court_block_id");--> statement-breakpoint
CREATE INDEX "court_allocations_court_active_period_idx" ON "court_allocations" USING btree ("court_id","active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "court_allocations_expiry_idx" ON "court_allocations" USING btree ("active","expires_at");--> statement-breakpoint
ALTER TABLE "court_allocations" ADD CONSTRAINT "court_allocations_no_active_overlap" EXCLUDE USING gist ("court_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&) WHERE ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_uidx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "customers_user_uidx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_merchant_code_uidx" ON "promo_codes" USING btree ("merchant_id",upper("code"));--> statement-breakpoint
CREATE INDEX "promo_codes_merchant_active_idx" ON "promo_codes" USING btree ("merchant_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_redemptions_booking_uidx" ON "promo_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "promo_redemptions_code_created_idx" ON "promo_redemptions" USING btree ("promo_code_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_memberships_merchant_user_uidx" ON "merchant_memberships" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "merchant_memberships_user_idx" ON "merchant_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "merchant_memberships_merchant_status_idx" ON "merchant_memberships" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_uidx" ON "merchants" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "manual_payment_proofs_booking_created_idx" ON "manual_payment_proofs" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "manual_payment_proofs_merchant_status_idx" ON "manual_payment_proofs" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_event_uidx" ON "payment_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_payment_payload_uidx" ON "payment_events" USING btree ("payment_id","payload_hash");--> statement-breakpoint
CREATE INDEX "payment_events_unprocessed_idx" ON "payment_events" USING btree ("processed_at","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_request_reference_uidx" ON "payments" USING btree ("request_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_id_uidx" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_merchant_status_created_idx" ON "payments" USING btree ("merchant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_provider_refund_id_uidx" ON "refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_merchant_status_created_idx" ON "refunds" USING btree ("merchant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_merchant_occurred_idx" ON "audit_events" USING btree ("merchant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_occurred_idx" ON "audit_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "court_subscription_usage_court_date_uidx" ON "court_subscription_usage" USING btree ("court_id","usage_date");--> statement-breakpoint
CREATE INDEX "court_subscription_usage_merchant_date_idx" ON "court_subscription_usage" USING btree ("merchant_id","usage_date");--> statement-breakpoint
CREATE INDEX "merchant_subscriptions_merchant_status_idx" ON "merchant_subscriptions" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_number_uidx" ON "subscription_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "subscription_invoices_merchant_status_idx" ON "subscription_invoices" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_policies_site_version_uidx" ON "cancellation_policies" USING btree ("site_id","version");--> statement-breakpoint
CREATE INDEX "cancellation_policies_site_active_idx" ON "cancellation_policies" USING btree ("site_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_policy_tiers_threshold_uidx" ON "cancellation_policy_tiers" USING btree ("policy_id","minimum_minutes_before_start");--> statement-breakpoint
CREATE INDEX "court_blocks_court_period_idx" ON "court_blocks" USING btree ("court_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "court_operating_hours_period_uidx" ON "court_operating_hours" USING btree ("court_id","day_of_week","opens_at");--> statement-breakpoint
CREATE UNIQUE INDEX "courts_site_slug_uidx" ON "courts" USING btree ("site_id",lower("slug"));--> statement-breakpoint
CREATE INDEX "courts_merchant_site_status_idx" ON "courts" USING btree ("merchant_id","site_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_site_assignments_membership_site_uidx" ON "merchant_site_assignments" USING btree ("membership_id","site_id");--> statement-breakpoint
CREATE INDEX "merchant_site_assignments_merchant_site_idx" ON "merchant_site_assignments" USING btree ("merchant_id","site_id");--> statement-breakpoint
CREATE INDEX "price_rules_site_active_idx" ON "price_rules" USING btree ("site_id","active");--> statement-breakpoint
CREATE INDEX "price_rules_court_active_idx" ON "price_rules" USING btree ("court_id","active");--> statement-breakpoint
CREATE INDEX "schedule_overrides_site_date_idx" ON "schedule_overrides" USING btree ("site_id","local_date");--> statement-breakpoint
CREATE INDEX "schedule_overrides_court_date_idx" ON "schedule_overrides" USING btree ("court_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "site_operating_hours_period_uidx" ON "site_operating_hours" USING btree ("site_id","day_of_week","opens_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_merchant_slug_uidx" ON "sites" USING btree ("merchant_id",lower("slug"));--> statement-breakpoint
CREATE INDEX "sites_merchant_status_idx" ON "sites" USING btree ("merchant_id","status");
