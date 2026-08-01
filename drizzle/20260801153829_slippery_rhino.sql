CREATE TYPE "public"."platform_role" AS ENUM('admin');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_subject" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" "platform_role";--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_subject_uidx" ON "users" USING btree ("auth_subject");