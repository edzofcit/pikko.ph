import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { JsonObject, timestamps } from "./common";
import { invoiceStatusEnum, subscriptionStatusEnum } from "./enums";
import { merchants, users } from "./identity";
import { courts } from "./venues";

export const merchantSubscriptions = pgTable(
  "merchant_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").default("trialing").notNull(),
    monthlyCourtPriceCents: integer("monthly_court_price_cents").notNull(),
    currentPeriodStart: date("current_period_start", { mode: "string" }).notNull(),
    currentPeriodEnd: date("current_period_end", { mode: "string" }).notNull(),
    gracePeriodDays: integer("grace_period_days").default(7).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("merchant_subscriptions_merchant_period_uidx").on(
      table.merchantId,
      table.currentPeriodStart,
    ),
    index("merchant_subscriptions_merchant_status_idx").on(
      table.merchantId,
      table.status,
    ),
    check(
      "merchant_subscriptions_price_nonnegative",
      sql`${table.monthlyCourtPriceCents} >= 0`,
    ),
    check(
      "merchant_subscriptions_valid_period",
      sql`${table.currentPeriodStart} < ${table.currentPeriodEnd}`,
    ),
  ],
);

export const courtSubscriptionUsage = pgTable(
  "court_subscription_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    courtId: uuid("court_id")
      .notNull()
      .references(() => courts.id, { onDelete: "restrict" }),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    billable: integer("billable").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("court_subscription_usage_court_date_uidx").on(
      table.courtId,
      table.usageDate,
    ),
    index("court_subscription_usage_merchant_date_idx").on(
      table.merchantId,
      table.usageDate,
    ),
    check("court_subscription_usage_billable_boolean", sql`${table.billable} in (0, 1)`),
    check(
      "court_subscription_usage_price_nonnegative",
      sql`${table.unitPriceCents} >= 0`,
    ),
  ],
);

export const subscriptionInvoices = pgTable(
  "subscription_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    courtCount: integer("court_count").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("subscription_invoices_number_uidx").on(table.invoiceNumber),
    uniqueIndex("subscription_invoices_merchant_period_uidx").on(
      table.merchantId,
      table.periodStart,
    ),
    index("subscription_invoices_merchant_status_idx").on(
      table.merchantId,
      table.status,
    ),
    check("subscription_invoices_court_count_nonnegative", sql`${table.courtCount} >= 0`),
    check(
      "subscription_invoices_amounts_nonnegative",
      sql`${table.subtotalCents} >= 0 and ${table.taxCents} >= 0 and ${table.totalCents} >= 0`,
    ),
    check(
      "subscription_invoices_valid_period",
      sql`${table.periodStart} < ${table.periodEnd}`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id").references(() => merchants.id, {
      onDelete: "restrict",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 160 }).notNull(),
    targetType: varchar("target_type", { length: 100 }).notNull(),
    targetId: uuid("target_id"),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    sourceIp: varchar("source_ip", { length: 64 }),
    userAgent: text("user_agent"),
    before: jsonb("before").$type<JsonObject>(),
    after: jsonb("after").$type<JsonObject>(),
    metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_merchant_occurred_idx").on(
      table.merchantId,
      table.occurredAt,
    ),
    index("audit_events_actor_occurred_idx").on(
      table.actorUserId,
      table.occurredAt,
    ),
    index("audit_events_target_idx").on(table.targetType, table.targetId),
  ],
);
