import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingItems, bookings, courts, payments, refunds, sites } from "@/db/schema";

export type MerchantCustomerTransaction = {
  bookingId: string;
  reference: string;
  transactionId: string;
  transactionAt: Date;
  siteId: string;
  siteName: string;
  courtNames: string[];
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  source: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  grossCents: number;
  refundCents: number;
  collectedCents: number;
};

export type MerchantCustomer = {
  key: string;
  name: string;
  email: string;
  phone: string;
  bookingCount: number;
  siteIds: string[];
  siteNames: string[];
  firstBookingAt: Date;
  lastBookingAt: Date;
  nextBookingAt: Date | null;
  grossCents: number;
  collectedCents: number;
  refundCents: number;
  activeInLast30Days: boolean;
  transactions: MerchantCustomerTransaction[];
};

function customerIdentity(row: { bookingId: string; customerId: string | null; customerEmail: string | null; customerMobileNumber: string | null }) {
  const email = row.customerEmail?.trim().toLowerCase();
  if (email) return `email:${email}`;
  if (row.customerId) return `customer:${row.customerId}`;
  const phone = row.customerMobileNumber?.replace(/\D/g, "");
  if (phone) return `phone:${phone}`;
  return `booking:${row.bookingId}`;
}

function customerKey(identity: string) {
  return createHash("sha256").update(identity).digest("hex").slice(0, 24);
}

function paymentMethodLabel(methods: string[]) {
  const labels: Record<string, string> = { maya_qrph: "Maya QRPH", manual_bank_transfer: "Manual bank transfer", manual_ewallet: "Manual e-wallet", cash: "Cash", complimentary: "Complimentary" };
  return Array.from(new Set(methods)).map((method) => labels[method] ?? method.replaceAll("_", " ")).join(", ") || "No payment";
}

export async function getMerchantCustomers({ merchantId, siteIds, selectedSiteId = "" }: { merchantId: string; siteIds: string[]; selectedSiteId?: string }) {
  const visibleSiteIds = selectedSiteId && siteIds.includes(selectedSiteId) ? [selectedSiteId] : siteIds;
  if (!visibleSiteIds.length) return [] as MerchantCustomer[];
  const db = getDb();
  const itemRows = await db.select({
    bookingId: bookings.id, customerId: bookings.customerId, reference: bookings.reference, source: bookings.source,
    customerName: bookings.customerName, customerEmail: bookings.customerEmail, customerMobileNumber: bookings.customerMobileNumber,
    siteId: bookings.siteId, siteName: sites.name, timezone: sites.timezone, courtId: courts.id, courtName: courts.name,
    startsAt: bookingItems.startsAt, endsAt: bookingItems.endsAt, bookingStatus: bookings.status, paymentStatus: bookings.paymentStatus,
    totalCents: bookings.totalCents, bookingCreatedAt: bookings.createdAt,
  }).from(bookings)
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(courts, eq(courts.id, bookingItems.courtId))
    .where(and(eq(bookings.merchantId, merchantId), inArray(bookings.siteId, visibleSiteIds)))
    .orderBy(desc(bookingItems.startsAt));
  const bookingIds = Array.from(new Set(itemRows.map((row) => row.bookingId)));
  const [paymentRows, refundRows] = bookingIds.length ? await Promise.all([
    db.select({ bookingId: payments.bookingId, requestReference: payments.requestReference, method: payments.method, status: payments.status, amountCents: payments.amountCents, paidAt: payments.paidAt, createdAt: payments.createdAt }).from(payments).where(and(eq(payments.merchantId, merchantId), inArray(payments.bookingId, bookingIds))).orderBy(desc(payments.createdAt)),
    db.select({ bookingId: refunds.bookingId, status: refunds.status, amountCents: refunds.amountCents }).from(refunds).where(and(eq(refunds.merchantId, merchantId), inArray(refunds.bookingId, bookingIds))),
  ]) : [[], []];
  const paymentsByBooking = new Map<string, typeof paymentRows>();
  for (const payment of paymentRows) paymentsByBooking.set(payment.bookingId, [...(paymentsByBooking.get(payment.bookingId) ?? []), payment]);
  const refundsByBooking = new Map<string, typeof refundRows>();
  for (const refund of refundRows) refundsByBooking.set(refund.bookingId, [...(refundsByBooking.get(refund.bookingId) ?? []), refund]);

  const transactions = new Map<string, MerchantCustomerTransaction & { identity: string; name: string; email: string; phone: string }>();
  for (const row of itemRows) {
    const existing = transactions.get(row.bookingId);
    if (existing) {
      if (!existing.courtNames.includes(row.courtName)) existing.courtNames.push(row.courtName);
      if (row.startsAt < existing.startsAt) existing.startsAt = row.startsAt;
      if (row.endsAt > existing.endsAt) existing.endsAt = row.endsAt;
      continue;
    }
    const bookingPayments = paymentsByBooking.get(row.bookingId) ?? [];
    const primaryPayment = bookingPayments.find((payment) => ["paid", "partially_refunded", "refunded"].includes(payment.status)) ?? bookingPayments[0];
    const recordedRefundCents = (refundsByBooking.get(row.bookingId) ?? []).filter((refund) => refund.status === "completed").reduce((sum, refund) => sum + refund.amountCents, 0);
    const refundCents = row.paymentStatus === "refunded" ? Math.max(row.totalCents, recordedRefundCents) : recordedRefundCents;
    const successfulCents = bookingPayments.filter((payment) => ["paid", "partially_refunded", "refunded"].includes(payment.status)).reduce((sum, payment) => sum + payment.amountCents, 0);
    transactions.set(row.bookingId, {
      identity: customerIdentity(row), name: row.customerName?.trim() || "Guest customer", email: row.customerEmail?.trim().toLowerCase() || "", phone: row.customerMobileNumber?.trim() || "",
      bookingId: row.bookingId, reference: row.reference, transactionId: primaryPayment?.requestReference ?? row.reference,
      transactionAt: primaryPayment?.paidAt ?? primaryPayment?.createdAt ?? row.bookingCreatedAt, siteId: row.siteId, siteName: row.siteName,
      courtNames: [row.courtName], startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone, source: row.source,
      bookingStatus: row.bookingStatus, paymentStatus: row.paymentStatus, paymentMethod: paymentMethodLabel(bookingPayments.map((payment) => payment.method)),
      grossCents: row.totalCents, refundCents, collectedCents: Math.max(0, successfulCents - refundCents),
    });
  }

  const now = new Date();
  const inactiveStatuses = new Set(["draft", "cancelled", "expired"]);
  const customersByIdentity = new Map<string, MerchantCustomer>();
  for (const transaction of transactions.values()) {
    const existing = customersByIdentity.get(transaction.identity);
    if (existing) {
      existing.bookingCount += 1;
      if (!existing.siteIds.includes(transaction.siteId)) { existing.siteIds.push(transaction.siteId); existing.siteNames.push(transaction.siteName); }
      if (transaction.startsAt < existing.firstBookingAt) existing.firstBookingAt = transaction.startsAt;
      if (transaction.startsAt > existing.lastBookingAt) existing.lastBookingAt = transaction.startsAt;
      if (!inactiveStatuses.has(transaction.bookingStatus) && transaction.startsAt > now && (!existing.nextBookingAt || transaction.startsAt < existing.nextBookingAt)) existing.nextBookingAt = transaction.startsAt;
      existing.grossCents += transaction.bookingStatus === "cancelled" || transaction.bookingStatus === "expired" ? 0 : transaction.grossCents;
      existing.collectedCents += transaction.collectedCents;
      existing.refundCents += transaction.refundCents;
      existing.transactions.push(transaction);
      if (existing.name === "Guest customer" && transaction.name !== "Guest customer") existing.name = transaction.name;
      if (!existing.email && transaction.email) existing.email = transaction.email;
      if (!existing.phone && transaction.phone) existing.phone = transaction.phone;
    } else {
      customersByIdentity.set(transaction.identity, {
        key: customerKey(transaction.identity), name: transaction.name, email: transaction.email, phone: transaction.phone,
        bookingCount: 1, siteIds: [transaction.siteId], siteNames: [transaction.siteName], firstBookingAt: transaction.startsAt, lastBookingAt: transaction.startsAt,
        nextBookingAt: !inactiveStatuses.has(transaction.bookingStatus) && transaction.startsAt > now ? transaction.startsAt : null,
        grossCents: transaction.bookingStatus === "cancelled" || transaction.bookingStatus === "expired" ? 0 : transaction.grossCents,
        collectedCents: transaction.collectedCents, refundCents: transaction.refundCents, activeInLast30Days: false, transactions: [transaction],
      });
    }
  }
  const recentThreshold = now.getTime() - 30 * 86_400_000;
  return Array.from(customersByIdentity.values()).map((customer) => ({ ...customer, activeInLast30Days: customer.transactions.some((transaction) => !inactiveStatuses.has(transaction.bookingStatus) && transaction.startsAt.getTime() >= recentThreshold && transaction.startsAt <= now), transactions: customer.transactions.sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime()) })).sort((left, right) => right.lastBookingAt.getTime() - left.lastBookingAt.getTime());
}
