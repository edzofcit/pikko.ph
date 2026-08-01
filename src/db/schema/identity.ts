import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./common";
import {
  merchantRoleEnum,
  merchantStatusEnum,
  subscriptionStatusEnum,
  userStatusEnum,
} from "./enums";

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }),
    slug: varchar("slug", { length: 100 }).notNull(),
    status: merchantStatusEnum("status").default("onboarding").notNull(),
    defaultTimezone: varchar("default_timezone", { length: 64 })
      .default("Asia/Manila")
      .notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    logoUrl: text("logo_url"),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .default("trialing")
      .notNull(),
    monthlyCourtPriceCents: integer("monthly_court_price_cents")
      .default(0)
      .notNull(),
    gatewayFeeBasisPoints: integer("gateway_fee_basis_points")
      .default(0)
      .notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("merchants_slug_uidx").on(sql`lower(${table.slug})`),
    check(
      "merchants_monthly_court_price_nonnegative",
      sql`${table.monthlyCourtPriceCents} >= 0`,
    ),
    check(
      "merchants_gateway_fee_basis_points_range",
      sql`${table.gatewayFeeBasisPoints} >= 0 and ${table.gatewayFeeBasisPoints} <= 10000`,
    ),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 40 }),
    status: userStatusEnum("status").default("invited").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(sql`lower(${table.email})`),
  ],
);

export const merchantMemberships = pgTable(
  "merchant_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: merchantRoleEnum("role").notNull(),
    status: userStatusEnum("status").default("invited").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("merchant_memberships_merchant_user_uidx").on(
      table.merchantId,
      table.userId,
    ),
    index("merchant_memberships_user_idx").on(table.userId),
    index("merchant_memberships_merchant_status_idx").on(
      table.merchantId,
      table.status,
    ),
  ],
);
