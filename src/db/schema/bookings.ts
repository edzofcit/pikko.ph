import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { JsonObject, timestamps } from "./common";
import {
  allocationKindEnum,
  bookingSourceEnum,
  bookingStatusEnum,
  checkoutHoldStatusEnum,
  discountTypeEnum,
  paymentStatusEnum,
} from "./enums";
import { merchants, users } from "./identity";
import {
  cancellationPolicies,
  courtBlocks,
  courts,
  sites,
} from "./venues";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: varchar("email", { length: 320 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 40 }),
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("customers_email_uidx").on(sql`lower(${table.email})`),
    uniqueIndex("customers_user_uidx").on(table.userId),
  ],
);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    maximumDiscountCents: integer("maximum_discount_cents"),
    minimumSpendCents: integer("minimum_spend_cents").default(0).notNull(),
    redemptionLimit: integer("redemption_limit"),
    perCustomerLimit: integer("per_customer_limit").default(1).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("promo_codes_merchant_code_uidx").on(
      table.merchantId,
      sql`upper(${table.code})`,
    ),
    index("promo_codes_merchant_active_idx").on(table.merchantId, table.active),
    check("promo_codes_value_positive", sql`${table.discountValue} > 0`),
    check("promo_codes_minimum_nonnegative", sql`${table.minimumSpendCents} >= 0`),
    check(
      "promo_codes_percentage_range",
      sql`${table.discountType} <> 'percentage' or ${table.discountValue} <= 10000`,
    ),
  ],
);

export const checkoutHolds = pgTable(
  "checkout_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    status: checkoutHoldStatusEnum("status").default("active").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    quotedTotalCents: integer("quoted_total_cents").notNull(),
    pricingSnapshot: jsonb("pricing_snapshot").$type<JsonObject>().default({}).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "checkout_holds_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("checkout_holds_token_hash_uidx").on(table.tokenHash),
    index("checkout_holds_status_expiry_idx").on(table.status, table.expiresAt),
    check("checkout_holds_total_nonnegative", sql`${table.quotedTotalCents} >= 0`),
  ],
);

export const checkoutHoldItems = pgTable(
  "checkout_hold_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    holdId: uuid("hold_id")
      .notNull()
      .references(() => checkoutHolds.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    quotedRateCents: integer("quoted_rate_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "checkout_hold_items_court_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("checkout_hold_items_hold_court_start_uidx").on(
      table.holdId,
      table.courtId,
      table.startsAt,
    ),
    check("checkout_hold_items_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "checkout_hold_items_rate_nonnegative",
      sql`${table.quotedRateCents} >= 0`,
    ),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    siteId: uuid("site_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    reference: varchar("reference", { length: 32 }).notNull(),
    source: bookingSourceEnum("source").notNull(),
    status: bookingStatusEnum("status").default("draft").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").default("unpaid").notNull(),
    customerName: varchar("customer_name", { length: 160 }),
    customerEmail: varchar("customer_email", { length: 320 }),
    customerMobileNumber: varchar("customer_mobile_number", { length: 40 }),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    subtotalCents: integer("subtotal_cents").default(0).notNull(),
    discountCents: integer("discount_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    merchantFeeCents: integer("merchant_fee_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    promoCodeId: uuid("promo_code_id").references(() => promoCodes.id, {
      onDelete: "set null",
    }),
    cancellationPolicyId: uuid("cancellation_policy_id").references(
      () => cancellationPolicies.id,
      { onDelete: "set null" },
    ),
    policySnapshot: jsonb("policy_snapshot").$type<JsonObject>().default({}).notNull(),
    pricingSnapshot: jsonb("pricing_snapshot").$type<JsonObject>().default({}).notNull(),
    customerNotes: text("customer_notes"),
    internalNotes: text("internal_notes"),
    paymentDueAt: timestamp("payment_due_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancellationReason: text("cancellation_reason"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "bookings_site_tenant_fk",
    }).onDelete("restrict"),
    uniqueIndex("bookings_reference_uidx").on(table.reference),
    unique("bookings_merchant_id_id_key").on(table.merchantId, table.id),
    index("bookings_merchant_site_created_idx").on(
      table.merchantId,
      table.siteId,
      table.createdAt,
    ),
    index("bookings_merchant_status_idx").on(table.merchantId, table.status),
    index("bookings_customer_idx").on(table.customerId),
    check(
      "bookings_amounts_nonnegative",
      sql`${table.subtotalCents} >= 0 and ${table.discountCents} >= 0 and ${table.taxCents} >= 0 and ${table.merchantFeeCents} >= 0 and ${table.totalCents} >= 0`,
    ),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").notNull(),
    courtId: uuid("court_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    priceRuleSnapshot: jsonb("price_rule_snapshot")
      .$type<JsonObject>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.bookingId],
      foreignColumns: [bookings.merchantId, bookings.id],
      name: "booking_items_booking_tenant_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "booking_items_court_tenant_fk",
    }).onDelete("restrict"),
    uniqueIndex("booking_items_booking_court_start_uidx").on(
      table.bookingId,
      table.courtId,
      table.startsAt,
    ),
    index("booking_items_court_period_idx").on(
      table.courtId,
      table.startsAt,
      table.endsAt,
    ),
    check("booking_items_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "booking_items_amounts_nonnegative",
      sql`${table.hourlyRateCents} >= 0 and ${table.lineTotalCents} >= 0`,
    ),
  ],
);

export const courtAllocations = pgTable(
  "court_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull(),
    kind: allocationKindEnum("kind").notNull(),
    bookingItemId: uuid("booking_item_id").references(() => bookingItems.id, {
      onDelete: "cascade",
    }),
    checkoutHoldItemId: uuid("checkout_hold_item_id").references(
      () => checkoutHoldItems.id,
      { onDelete: "cascade" },
    ),
    courtBlockId: uuid("court_block_id").references(() => courtBlocks.id, {
      onDelete: "cascade",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    active: boolean("active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "court_allocations_court_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("court_allocations_booking_item_uidx").on(table.bookingItemId),
    uniqueIndex("court_allocations_hold_item_uidx").on(table.checkoutHoldItemId),
    uniqueIndex("court_allocations_block_uidx").on(table.courtBlockId),
    index("court_allocations_court_active_period_idx").on(
      table.courtId,
      table.active,
      table.startsAt,
      table.endsAt,
    ),
    index("court_allocations_expiry_idx").on(table.active, table.expiresAt),
    check("court_allocations_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
    check(
      "court_allocations_exactly_one_source",
      sql`num_nonnulls(${table.bookingItemId}, ${table.checkoutHoldItemId}, ${table.courtBlockId}) = 1`,
    ),
    check(
      "court_allocations_kind_matches_source",
      sql`(${table.kind} = 'booking' and ${table.bookingItemId} is not null) or (${table.kind} = 'checkout_hold' and ${table.checkoutHoldItemId} is not null) or (${table.kind} = 'merchant_block' and ${table.courtBlockId} is not null)`,
    ),
  ],
);

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    promoCodeId: uuid("promo_code_id")
      .notNull()
      .references(() => promoCodes.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    discountCents: integer("discount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.bookingId],
      foreignColumns: [bookings.merchantId, bookings.id],
      name: "promo_redemptions_booking_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("promo_redemptions_booking_uidx").on(table.bookingId),
    index("promo_redemptions_code_created_idx").on(
      table.promoCodeId,
      table.createdAt,
    ),
    check(
      "promo_redemptions_discount_nonnegative",
      sql`${table.discountCents} >= 0`,
    ),
  ],
);
