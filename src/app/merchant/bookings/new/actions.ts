"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  auditEvents,
  bookingItems,
  bookings,
  courtAllocations,
  payments,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { getSiteAvailability } from "@/lib/booking/availability";

export type MerchantBookingState = { error: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOOKING_SOURCES = new Set([
  "merchant_walk_in",
  "merchant_phone",
  "merchant_complimentary",
]);
const PAYMENT_HANDLING = new Set([
  "cash_paid",
  "pay_at_venue",
  "complimentary",
]);

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bookingReference() {
  return `PK-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function isCourtConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  return (
    candidate.code === "23P01" ||
    candidate.constraint === "court_allocations_no_active_overlap" ||
    candidate.message?.includes("court_allocations_no_active_overlap") === true
  );
}

export async function createMerchantBooking(
  _previousState: MerchantBookingState,
  formData: FormData,
): Promise<MerchantBookingState> {
  const access = await requireMerchantPermission("manage_bookings");
  const merchantSlug = access.membership.merchantSlug;
  const siteSlug = readText(formData, "siteSlug");
  const date = readText(formData, "date");
  const courtId = readText(formData, "courtId");
  const source = readText(formData, "source");
  const submittedPaymentHandling = readText(formData, "paymentHandling");
  const paymentHandling =
    source === "merchant_complimentary"
      ? "complimentary"
      : submittedPaymentHandling;
  const requestedStarts = readText(formData, "starts")
    .split(",")
    .filter(Boolean)
    .slice(0, 12)
    .sort();
  const customerName = readText(formData, "customerName");
  const customerEmail = readText(formData, "customerEmail").toLowerCase();
  const customerMobileNumber = readText(formData, "customerMobileNumber");
  const internalNotes = readText(formData, "internalNotes");

  if (
    !siteSlug ||
    !UUID_PATTERN.test(courtId) ||
    !BOOKING_SOURCES.has(source) ||
    !PAYMENT_HANDLING.has(paymentHandling) ||
    requestedStarts.length === 0 ||
    customerName.length < 2 ||
    customerName.length > 160 ||
    (customerEmail.length > 0 &&
      (!EMAIL_PATTERN.test(customerEmail) || customerEmail.length > 320)) ||
    (customerMobileNumber.length > 0 &&
      (customerMobileNumber.length < 7 || customerMobileNumber.length > 40)) ||
    internalNotes.length > 1000
  ) {
    return {
      error:
        "Check the booking source, customer details, payment option, and selected times.",
    };
  }

  const availability = await getSiteAvailability(merchantSlug, siteSlug, date);
  if (
    !availability ||
    availability.merchant.id !== access.membership.merchantId ||
    !access.sites.some((site) => site.id === availability.site.id)
  ) {
    return { error: "This site is not available to your merchant account." };
  }

  const court = availability.courts.find((item) => item.id === courtId);
  const selectedSlots = court?.slots
    .filter((slot) => requestedStarts.includes(slot.startsAt))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const contiguous = selectedSlots?.every((slot, index) => {
    if (index === 0) return true;
    return (
      new Date(slot.startsAt).getTime() -
        new Date(selectedSlots[index - 1].startsAt).getTime() ===
      3_600_000
    );
  });

  if (
    !court ||
    !selectedSlots ||
    selectedSlots.length !== requestedStarts.length ||
    !contiguous
  ) {
    return {
      error:
        "One or more times are no longer available. Reload the schedule and select again.",
    };
  }

  const complimentary = paymentHandling === "complimentary";
  const paid = paymentHandling === "cash_paid" || complimentary;
  const now = new Date();
  const bookingId = randomUUID();
  const reference = bookingReference();
  const quotedSubtotalCents = selectedSlots.reduce(
    (total, slot) => total + slot.rateCents,
    0,
  );
  const totalCents = complimentary ? 0 : quotedSubtotalCents;
  const itemRows = selectedSlots.map((slot) => ({
    id: randomUUID(),
    merchantId: availability.merchant.id,
    bookingId,
    courtId: court.id,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
    hourlyRateCents: slot.rateCents,
    lineTotalCents: complimentary ? 0 : slot.rateCents,
    priceRuleSnapshot: {
      quotedAt: now.toISOString(),
      source,
      complimentary,
      date: availability.date,
      timezone: availability.site.timezone,
    },
  }));
  const paymentMethod = complimentary ? "complimentary" : "cash";
  const paymentStatus = paid ? "paid" : "unpaid";
  const db = getDb();

  try {
    await db.batch([
      db
        .update(courtAllocations)
        .set({ active: false, releasedAt: now })
        .where(
          and(
            eq(courtAllocations.courtId, court.id),
            eq(courtAllocations.active, true),
            lte(courtAllocations.expiresAt, now),
          ),
        ),
      db.insert(bookings).values({
        id: bookingId,
        merchantId: availability.merchant.id,
        siteId: availability.site.id,
        reference,
        source: source as
          | "merchant_walk_in"
          | "merchant_phone"
          | "merchant_complimentary",
        status: "confirmed",
        paymentStatus,
        customerName,
        customerEmail: customerEmail || null,
        customerMobileNumber: customerMobileNumber || null,
        subtotalCents: totalCents,
        totalCents,
        internalNotes: internalNotes || null,
        confirmedAt: now,
        createdByUserId: access.user.id,
        pricingSnapshot: {
          quotedAt: now.toISOString(),
          quotedSubtotalCents,
          complimentary,
          date: availability.date,
          timezone: availability.site.timezone,
          courtName: court.name,
          slotCount: selectedSlots.length,
        },
        policySnapshot: { staffCreated: true, source },
      }),
      db.insert(bookingItems).values(itemRows),
      db.insert(payments).values({
        id: randomUUID(),
        merchantId: availability.merchant.id,
        bookingId,
        provider: "none",
        method: paymentMethod,
        status: paymentStatus,
        amountCents: totalCents,
        requestReference: `STAFF-${reference}`,
        paidAt: paid ? now : null,
        metadata: { source, createdByUserId: access.user.id },
      }),
      db.insert(courtAllocations).values(
        itemRows.map((item) => ({
          merchantId: item.merchantId,
          courtId: item.courtId,
          kind: "booking" as const,
          bookingItemId: item.id,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        })),
      ),
      db.insert(auditEvents).values({
        merchantId: availability.merchant.id,
        actorUserId: access.user.id,
        action: "merchant.booking.created",
        targetType: "booking",
        targetId: bookingId,
        after: {
          reference,
          source,
          paymentHandling,
          courtId: court.id,
          starts: requestedStarts,
          totalCents,
        },
      }),
    ]);
  } catch (error) {
    if (isCourtConflict(error)) {
      return {
        error:
          "Another booking just took one of these times. Reload and choose another slot.",
      };
    }
    console.error("Merchant booking creation failed", error);
    return { error: "The booking could not be created. Please try again." };
  }

  redirect(`/merchant/bookings/${bookingId}?success=Booking%20created.`);
}
