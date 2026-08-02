import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { bookingItems, bookings, courtAllocations, paymentEvents, payments } from "@/db/schema";
import { getMayaConfig, retrieveMayaPayment } from "@/lib/payments/maya";

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function mayaOutcome(payload: Record<string, unknown>) {
  const paymentStatus = stringValue(payload.paymentStatus).toUpperCase();
  const status = stringValue(payload.status).toUpperCase();
  if (paymentStatus === "PAYMENT_SUCCESS" || status === "COMPLETED") return "paid" as const;
  if (
    paymentStatus.includes("FAIL") ||
    ["FAILED", "FAILURE", "CANCELLED", "EXPIRED", "VOIDED"].includes(status)
  ) return "failed" as const;
  return "pending" as const;
}

export async function reconcileMayaPayment(providerPaymentId: string) {
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.provider, "maya"), eq(payments.providerPaymentId, providerPaymentId)))
    .limit(1);
  if (!payment) return { outcome: "unknown" as const };
  if (payment.status === "paid") return { outcome: "paid" as const, payment };

  const config = await getMayaConfig({ requireEnabled: false });
  if (!config) throw new Error("Maya credentials are not configured.");
  const provider = await retrieveMayaPayment(config, providerPaymentId);
  const providerReference = stringValue(
    provider.receiptNumber ?? provider.transactionReferenceNumber ?? provider.processorRefNo,
  );
  const providerRequestReference = stringValue(provider.requestReferenceNumber);
  const totalAmount = provider.totalAmount as Record<string, unknown> | undefined;
  const providerAmountCents = Math.round(Number(totalAmount?.value ?? Number.NaN) * 100);
  const providerCurrency = stringValue(totalAmount?.currency || "PHP").toUpperCase();

  if (
    providerRequestReference !== payment.requestReference ||
    providerAmountCents !== payment.amountCents ||
    providerCurrency !== payment.currency
  ) {
    throw new Error("Maya payment reconciliation values do not match the booking.");
  }

  const outcome = mayaOutcome(provider);
  const now = new Date();
  const payloadHash = createHash("sha256").update(JSON.stringify(provider)).digest("hex");
  const providerStatus = stringValue(provider.paymentStatus || provider.status) || "UNKNOWN";
  const itemRows = await db
    .select({ id: bookingItems.id })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, payment.bookingId));
  const itemIds = itemRows.map((item) => item.id);
  const event = db.insert(paymentEvents).values({
    id: randomUUID(),
    merchantId: payment.merchantId,
    paymentId: payment.id,
    eventType: `maya.retrieved.${providerStatus.toLowerCase()}`,
    payloadHash,
    payload: provider,
    processedAt: now,
  }).onConflictDoNothing();

  if (outcome === "paid") {
    await db.batch([
      db.update(payments).set({ status: "paid", providerStatus, providerReference: providerReference || null, paidAt: now, failedAt: null, updatedAt: now }).where(eq(payments.id, payment.id)),
      db.update(bookings).set({ status: "confirmed", paymentStatus: "paid", confirmedAt: now, paymentDueAt: null, updatedAt: now }).where(eq(bookings.id, payment.bookingId)),
      ...(itemIds.length ? [db.update(courtAllocations).set({ expiresAt: null }).where(and(eq(courtAllocations.kind, "booking"), eq(courtAllocations.active, true), inArray(courtAllocations.bookingItemId, itemIds)))] : []),
      event,
    ]);
  } else if (outcome === "failed") {
    await db.batch([
      db.update(payments).set({ status: "failed", providerStatus, providerReference: providerReference || null, failedAt: now, updatedAt: now }).where(eq(payments.id, payment.id)),
      db.update(bookings).set({ status: "cancelled", paymentStatus: "failed", cancelledAt: now, cancellationReason: "Maya payment was not completed.", updatedAt: now }).where(eq(bookings.id, payment.bookingId)),
      ...(itemIds.length ? [db.update(courtAllocations).set({ active: false, releasedAt: now }).where(and(eq(courtAllocations.kind, "booking"), eq(courtAllocations.active, true), inArray(courtAllocations.bookingItemId, itemIds)))] : []),
      event,
    ]);
  } else {
    await db.batch([
      db.update(payments).set({ providerStatus, providerReference: providerReference || null, updatedAt: now }).where(eq(payments.id, payment.id)),
      event,
    ]);
  }
  return { outcome, payment, provider };
}
