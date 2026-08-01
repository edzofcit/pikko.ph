import { sql } from "drizzle-orm";
import {
  check,
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
import {
  manualProofStatusEnum,
  paymentMethodEnum,
  paymentProviderEnum,
  paymentStatusEnum,
  refundStatusEnum,
} from "./enums";
import { merchants, users } from "./identity";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    requestReference: varchar("request_reference", { length: 100 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    providerReference: varchar("provider_reference", { length: 160 }),
    providerStatus: varchar("provider_status", { length: 80 }),
    gatewayFeeBasisPoints: integer("gateway_fee_basis_points").default(0).notNull(),
    platformFeeCents: integer("platform_fee_cents").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCode: varchar("failure_code", { length: 100 }),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("payments_request_reference_uidx").on(table.requestReference),
    uniqueIndex("payments_provider_payment_id_uidx").on(table.providerPaymentId),
    index("payments_booking_idx").on(table.bookingId),
    index("payments_merchant_status_created_idx").on(
      table.merchantId,
      table.status,
      table.createdAt,
    ),
    check("payments_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check("payments_platform_fee_nonnegative", sql`${table.platformFeeCents} >= 0`),
    check(
      "payments_gateway_fee_range",
      sql`${table.gatewayFeeBasisPoints} >= 0 and ${table.gatewayFeeBasisPoints} <= 10000`,
    ),
  ],
);

export const manualPaymentProofs = pgTable(
  "manual_payment_proofs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    status: manualProofStatusEnum("status").default("submitted").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    customerNotes: text("customer_notes"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("manual_payment_proofs_booking_created_idx").on(
      table.bookingId,
      table.createdAt,
    ),
    index("manual_payment_proofs_merchant_status_idx").on(
      table.merchantId,
      table.status,
    ),
    check("manual_payment_proofs_size_positive", sql`${table.sizeBytes} > 0`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    status: refundStatusEnum("status").default("pending").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("PHP").notNull(),
    providerRefundId: varchar("provider_refund_id", { length: 160 }),
    reason: text("reason").notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureMessage: text("failure_message"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("refunds_provider_refund_id_uidx").on(table.providerRefundId),
    index("refunds_payment_idx").on(table.paymentId),
    index("refunds_merchant_status_created_idx").on(
      table.merchantId,
      table.status,
      table.createdAt,
    ),
    check("refunds_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    providerEventId: varchar("provider_event_id", { length: 200 }),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    payload: jsonb("payload").$type<JsonObject>().default({}).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_uidx").on(table.providerEventId),
    uniqueIndex("payment_events_payment_payload_uidx").on(
      table.paymentId,
      table.payloadHash,
    ),
    index("payment_events_unprocessed_idx").on(table.processedAt, table.receivedAt),
  ],
);
