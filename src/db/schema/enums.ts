import { pgEnum } from "drizzle-orm/pg-core";

export const merchantStatusEnum = pgEnum("merchant_status", [
  "onboarding",
  "active",
  "suspended",
  "archived",
]);

export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "suspended",
]);

export const merchantRoleEnum = pgEnum("merchant_role", [
  "owner",
  "site_manager",
  "booking_staff",
  "cashier",
  "viewer",
]);

export const siteStatusEnum = pgEnum("site_status", [
  "draft",
  "active",
  "inactive",
]);

export const courtStatusEnum = pgEnum("court_status", [
  "active",
  "inactive",
  "maintenance",
]);

export const manualReservationModeEnum = pgEnum("manual_reservation_mode", [
  "reserve_immediately",
  "reserve_after_verification",
]);

export const blockTypeEnum = pgEnum("court_block_type", [
  "maintenance",
  "private_event",
  "temporary_closure",
]);

export const priceRuleTypeEnum = pgEnum("price_rule_type", [
  "recurring",
  "special_date",
  "seasonal",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "fixed",
  "percentage",
]);

export const bookingSourceEnum = pgEnum("booking_source", [
  "customer_web",
  "merchant_walk_in",
  "merchant_phone",
  "merchant_complimentary",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "pending_payment",
  "pending_verification",
  "confirmed",
  "cancelled",
  "expired",
  "completed",
  "no_show",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "rejected",
  "failed",
  "partially_refunded",
  "refunded",
]);

export const checkoutHoldStatusEnum = pgEnum("checkout_hold_status", [
  "active",
  "converted",
  "expired",
  "cancelled",
]);

export const allocationKindEnum = pgEnum("court_allocation_kind", [
  "checkout_hold",
  "booking",
  "merchant_block",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "maya",
  "manual",
  "none",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "maya_qrph",
  "manual_bank_transfer",
  "manual_ewallet",
  "cash",
  "complimentary",
]);

export const manualProofStatusEnum = pgEnum("manual_proof_status", [
  "submitted",
  "approved",
  "rejected",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "past_due",
  "void",
]);
