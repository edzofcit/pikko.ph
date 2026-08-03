import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { JsonObject, timestamps } from "./common";
import {
  blockTypeEnum,
  courtStatusEnum,
  manualReservationModeEnum,
  priceRuleTypeEnum,
  siteStatusEnum,
} from "./enums";
import { merchantMemberships, merchants, users } from "./identity";
import type { ManualPaymentOption } from "@/lib/manual-payment/options";

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    status: siteStatusEnum("status").default("draft").notNull(),
    description: text("description"),
    addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 200 }),
    city: varchar("city", { length: 100 }).notNull(),
    province: varchar("province", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    countryCode: varchar("country_code", { length: 2 }).default("PH").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    timezone: varchar("timezone", { length: 64 })
      .default("Asia/Manila")
      .notNull(),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    amenities: jsonb("amenities").$type<string[]>().default([]).notNull(),
    policies: jsonb("policies").$type<JsonObject>().default({}).notNull(),
    bookingLeadMinutes: integer("booking_lead_minutes").default(60).notNull(),
    advanceBookingDays: integer("advance_booking_days").default(30).notNull(),
    onlinePaymentEnabled: boolean("online_payment_enabled").default(false).notNull(),
    manualPaymentEnabled: boolean("manual_payment_enabled").default(false).notNull(),
    manualReservationMode: manualReservationModeEnum("manual_reservation_mode")
      .default("reserve_immediately")
      .notNull(),
    manualPaymentDeadlineMinutes: integer("manual_payment_deadline_minutes")
      .default(30)
      .notNull(),
    manualPaymentInstructions: text("manual_payment_instructions"),
    manualPaymentQrUrl: text("manual_payment_qr_url"),
    manualPaymentOptions: jsonb("manual_payment_options")
      .$type<ManualPaymentOption[]>()
      .default([])
      .notNull(),
    taxInclusive: boolean("tax_inclusive").default(true).notNull(),
    taxBasisPoints: integer("tax_basis_points").default(0).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("sites_merchant_slug_uidx").on(
      table.merchantId,
      sql`lower(${table.slug})`,
    ),
    unique("sites_merchant_id_id_key").on(table.merchantId, table.id),
    index("sites_merchant_status_idx").on(table.merchantId, table.status),
    check("sites_booking_lead_nonnegative", sql`${table.bookingLeadMinutes} >= 0`),
    check("sites_advance_days_positive", sql`${table.advanceBookingDays} > 0`),
    check(
      "sites_manual_deadline_positive",
      sql`${table.manualPaymentDeadlineMinutes} > 0`,
    ),
    check(
      "sites_tax_basis_points_range",
      sql`${table.taxBasisPoints} >= 0 and ${table.taxBasisPoints} <= 10000`,
    ),
  ],
);

export const merchantSiteAssignments = pgTable(
  "merchant_site_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => merchantMemberships.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "merchant_site_assignments_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("merchant_site_assignments_membership_site_uidx").on(
      table.membershipId,
      table.siteId,
    ),
    index("merchant_site_assignments_merchant_site_idx").on(
      table.merchantId,
      table.siteId,
    ),
  ],
);

export const courts = pgTable(
  "courts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    status: courtStatusEnum("status").default("active").notNull(),
    baseHourlyRateCents: integer("base_hourly_rate_cents").notNull(),
    surfaceType: varchar("surface_type", { length: 100 }),
    indoor: boolean("indoor").default(false).notNull(),
    amenities: jsonb("amenities").$type<string[]>().default([]).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "courts_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("courts_site_slug_uidx").on(table.siteId, sql`lower(${table.slug})`),
    unique("courts_merchant_id_id_key").on(table.merchantId, table.id),
    index("courts_merchant_site_status_idx").on(
      table.merchantId,
      table.siteId,
      table.status,
    ),
    check(
      "courts_base_hourly_rate_nonnegative",
      sql`${table.baseHourlyRateCents} >= 0`,
    ),
  ],
);

export const sitePhotos = pgTable(
  "site_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    isCover: boolean("is_cover").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "site_photos_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("site_photos_pathname_uidx").on(table.pathname),
    uniqueIndex("site_photos_single_cover_uidx")
      .on(table.siteId)
      .where(sql`${table.isCover}`),
    index("site_photos_site_order_idx").on(table.siteId, table.sortOrder),
  ],
);

export const courtPhotos = pgTable(
  "court_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull(),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    altText: varchar("alt_text", { length: 200 }),
    isCover: boolean("is_cover").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "court_photos_court_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("court_photos_pathname_uidx").on(table.pathname),
    uniqueIndex("court_photos_single_cover_uidx")
      .on(table.courtId)
      .where(sql`${table.isCover}`),
    index("court_photos_court_order_idx").on(table.courtId, table.sortOrder),
  ],
);

export const siteOperatingHours = pgTable(
  "site_operating_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "site_operating_hours_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("site_operating_hours_period_uidx").on(
      table.siteId,
      table.dayOfWeek,
      table.opensAt,
    ),
    check("site_operating_hours_day_range", sql`${table.dayOfWeek} between 0 and 6`),
    check("site_operating_hours_valid_period", sql`${table.opensAt} < ${table.closesAt}`),
  ],
);

export const courtOperatingHours = pgTable(
  "court_operating_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "court_operating_hours_court_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("court_operating_hours_period_uidx").on(
      table.courtId,
      table.dayOfWeek,
      table.opensAt,
    ),
    check("court_operating_hours_day_range", sql`${table.dayOfWeek} between 0 and 6`),
    check("court_operating_hours_valid_period", sql`${table.opensAt} < ${table.closesAt}`),
  ],
);

export const scheduleOverrides = pgTable(
  "schedule_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    courtId: uuid("court_id"),
    localDate: date("local_date", { mode: "string" }).notNull(),
    isClosed: boolean("is_closed").default(false).notNull(),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
    label: varchar("label", { length: 160 }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "schedule_overrides_site_tenant_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "schedule_overrides_court_tenant_fk",
    }).onDelete("cascade"),
    index("schedule_overrides_site_date_idx").on(table.siteId, table.localDate),
    index("schedule_overrides_court_date_idx").on(table.courtId, table.localDate),
    check(
      "schedule_overrides_valid_period",
      sql`${table.isClosed} or (${table.opensAt} is not null and ${table.closesAt} is not null and ${table.opensAt} < ${table.closesAt})`,
    ),
  ],
);

export const courtBlocks = pgTable(
  "court_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull(),
    type: blockTypeEnum("type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    customerVisible: boolean("customer_visible").default(true).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "court_blocks_court_tenant_fk",
    }).onDelete("cascade"),
    index("court_blocks_court_period_idx").on(
      table.courtId,
      table.startsAt,
      table.endsAt,
    ),
    check("court_blocks_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
  ],
);

export const priceRules = pgTable(
  "price_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    courtId: uuid("court_id"),
    name: varchar("name", { length: 160 }).notNull(),
    type: priceRuleTypeEnum("type").notNull(),
    dayOfWeek: integer("day_of_week"),
    specialDate: date("special_date", { mode: "string" }),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    activeFrom: date("active_from", { mode: "string" }),
    activeUntil: date("active_until", { mode: "string" }),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    priority: integer("priority").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "price_rules_site_tenant_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.merchantId, table.courtId],
      foreignColumns: [courts.merchantId, courts.id],
      name: "price_rules_court_tenant_fk",
    }).onDelete("cascade"),
    index("price_rules_site_active_idx").on(table.siteId, table.active),
    index("price_rules_court_active_idx").on(table.courtId, table.active),
    check("price_rules_valid_period", sql`${table.startsAt} < ${table.endsAt}`),
    check("price_rules_rate_nonnegative", sql`${table.hourlyRateCents} >= 0`),
    check(
      "price_rules_day_range",
      sql`${table.dayOfWeek} is null or ${table.dayOfWeek} between 0 and 6`,
    ),
    check(
      "price_rules_type_fields",
      sql`(${table.type} = 'recurring' and ${table.dayOfWeek} is not null and ${table.specialDate} is null) or (${table.type} = 'special_date' and ${table.specialDate} is not null) or (${table.type} = 'seasonal' and ${table.activeFrom} is not null and ${table.activeUntil} is not null)`,
    ),
  ],
);

export const cancellationPolicies = pgTable(
  "cancellation_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    version: integer("version").notNull(),
    customerCancellationEnabled: boolean("customer_cancellation_enabled")
      .default(true)
      .notNull(),
    selfServiceCutoffMinutes: integer("self_service_cutoff_minutes")
      .default(360)
      .notNull(),
    noShowGraceMinutes: integer("no_show_grace_minutes").default(15).notNull(),
    refundTax: boolean("refund_tax").default(true).notNull(),
    refundMerchantFees: boolean("refund_merchant_fees").default(false).notNull(),
    refundGatewayFees: boolean("refund_gateway_fees").default(false).notNull(),
    customerVisibleText: text("customer_visible_text").notNull(),
    active: boolean("active").default(true).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      columns: [table.merchantId, table.siteId],
      foreignColumns: [sites.merchantId, sites.id],
      name: "cancellation_policies_site_tenant_fk",
    }).onDelete("cascade"),
    uniqueIndex("cancellation_policies_site_version_uidx").on(
      table.siteId,
      table.version,
    ),
    index("cancellation_policies_site_active_idx").on(table.siteId, table.active),
    check(
      "cancellation_policies_cutoff_nonnegative",
      sql`${table.selfServiceCutoffMinutes} >= 0`,
    ),
    check(
      "cancellation_policies_grace_nonnegative",
      sql`${table.noShowGraceMinutes} >= 0`,
    ),
  ],
);

export const cancellationPolicyTiers = pgTable(
  "cancellation_policy_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => cancellationPolicies.id, { onDelete: "cascade" }),
    minimumMinutesBeforeStart: integer("minimum_minutes_before_start").notNull(),
    refundBasisPoints: integer("refund_basis_points").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("cancellation_policy_tiers_threshold_uidx").on(
      table.policyId,
      table.minimumMinutesBeforeStart,
    ),
    check(
      "cancellation_policy_tiers_minutes_nonnegative",
      sql`${table.minimumMinutesBeforeStart} >= 0`,
    ),
    check(
      "cancellation_policy_tiers_refund_range",
      sql`${table.refundBasisPoints} >= 0 and ${table.refundBasisPoints} <= 10000`,
    ),
  ],
);
