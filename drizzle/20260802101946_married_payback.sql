CREATE TABLE "court_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"alt_text" varchar(200),
	"is_cover" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"alt_text" varchar(200),
	"is_cover" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "court_photos" ADD CONSTRAINT "court_photos_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_photos" ADD CONSTRAINT "court_photos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_photos" ADD CONSTRAINT "court_photos_court_tenant_fk" FOREIGN KEY ("merchant_id","court_id") REFERENCES "public"."courts"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_site_tenant_fk" FOREIGN KEY ("merchant_id","site_id") REFERENCES "public"."sites"("merchant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "court_photos_pathname_uidx" ON "court_photos" USING btree ("pathname");--> statement-breakpoint
CREATE UNIQUE INDEX "court_photos_single_cover_uidx" ON "court_photos" USING btree ("court_id") WHERE "court_photos"."is_cover";--> statement-breakpoint
CREATE INDEX "court_photos_court_order_idx" ON "court_photos" USING btree ("court_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "site_photos_pathname_uidx" ON "site_photos" USING btree ("pathname");--> statement-breakpoint
CREATE UNIQUE INDEX "site_photos_single_cover_uidx" ON "site_photos" USING btree ("site_id") WHERE "site_photos"."is_cover";--> statement-breakpoint
CREATE INDEX "site_photos_site_order_idx" ON "site_photos" USING btree ("site_id","sort_order");