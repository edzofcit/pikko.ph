"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookingItems,
  bookings,
  courtAllocations,
  payments,
} from "@/db/schema";
import { getSiteAvailability } from "@/lib/booking/availability";

export type ManualBookingState = { error: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bookingReference() {
  return `PK-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isCourtConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string; message?: string };
  return (
    candidate.code === "23P01" ||
    candidate.constraint === "court_allocations_no_active_overlap" ||
    candidate.message?.includes("court_allocations_no_active_overlap") === true
  );
}

export async function createManualBooking(
  _previousState: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  const merchantSlug = readText(formData, "merchantSlug");
  const siteSlug = readText(formData, "siteSlug");
  const date = readText(formData, "date");
  const courtId = readText(formData, "courtId");
  const requestedStarts = readText(formData, "starts")
    .split(",")
    .filter(Boolean)
    .slice(0, 12)
    .sort();
  const fullName = readText(formData, "fullName");
  const email = readText(formData, "email").toLowerCase();
  const mobileNumber = readText(formData, "mobileNumber");
  const customerNotes = readText(formData, "customerNotes");

  if (
    !merchantSlug ||
    !siteSlug ||
    !UUID_PATTERN.test(courtId) ||
    requestedStarts.length === 0 ||
    fullName.length < 2 ||
    fullName.length > 160 ||
    !EMAIL_PATTERN.test(email) ||
    email.length > 320 ||
    mobileNumber.length < 7 ||
    mobileNumber.length > 40 ||
    customerNotes.length > 1000 ||
    formData.get("acceptPolicies") !== "on"
  ) {
    return { error: "Check your contact details and accept the booking policy." };
  }

  const availability = await getSiteAvailability(merchantSlug, siteSlug, date);
  if (!availability || !availability.site.manualPaymentEnabled) {
    return { error: "Manual payment is not available for this venue." };
  }

  const court = availability.courts.find((item) => item.id === courtId);
  const selectedSlots = court?.slots
    .filter((slot) => requestedStarts.includes(slot.startsAt))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const allAvailable =
    Boolean(court) &&
    selectedSlots?.length === requestedStarts.length &&
    requestedStarts.length > 0;
  const contiguous = selectedSlots?.every((slot, index) => {
    if (index === 0) return true;
    return (
      new Date(slot.startsAt).getTime() -
        new Date(selectedSlots[index - 1].startsAt).getTime() ===
      3_600_000
    );
  });

  if (!court || !selectedSlots || !allAvailable || !contiguous) {
    return { error: "One or more selected times are no longer available. Return to the schedule and choose again." };
  }

  const db = getDb();
  const now = new Date();
  const paymentDueAt = new Date(
    now.getTime() + availability.site.manualPaymentDeadlineMinutes * 60_000,
  );
  const bookingId = randomUUID();
  const reference = bookingReference();
  const accessToken = randomBytes(32).toString("base64url");
  const accessTokenId = randomUUID();
  const paymentId = randomUUID();
  const subtotalCents = selectedSlots.reduce(
    (total, slot) => total + slot.rateCents,
    0,
  );
  const itemRows = selectedSlots.map((slot) => ({
    id: randomUUID(),
    merchantId: availability.merchant.id,
    bookingId,
    courtId: court.id,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
    hourlyRateCents: slot.rateCents,
    lineTotalCents: slot.rateCents,
    priceRuleSnapshot: {
      quotedAt: now.toISOString(),
      date: availability.date,
      timezone: availability.site.timezone,
    },
  }));
  const reserveImmediately =
    availability.site.manualReservationMode === "reserve_immediately";

  const releaseExpiredAllocations = db
    .update(courtAllocations)
    .set({ active: false, releasedAt: now })
    .where(
      and(
        eq(courtAllocations.courtId, court.id),
        eq(courtAllocations.active, true),
        lte(courtAllocations.expiresAt, now),
      ),
    );
  const insertBooking = db.insert(bookings).values({
      id: bookingId,
      merchantId: availability.merchant.id,
      siteId: availability.site.id,
      reference,
      source: "customer_web",
      status: "pending_payment",
      paymentStatus: "pending",
      customerName: fullName,
      customerEmail: email,
      customerMobileNumber: mobileNumber,
      subtotalCents,
      totalCents: subtotalCents,
      customerNotes: customerNotes || null,
      paymentDueAt,
      pricingSnapshot: {
        quotedAt: now.toISOString(),
        date: availability.date,
        timezone: availability.site.timezone,
        courtName: court.name,
        slotCount: selectedSlots.length,
      },
      policySnapshot: {
        manualReservationMode: availability.site.manualReservationMode,
        manualPaymentDeadlineMinutes:
          availability.site.manualPaymentDeadlineMinutes,
      },
    });
  const insertItems = db.insert(bookingItems).values(itemRows);
  const insertPayment = db.insert(payments).values({
      id: paymentId,
      merchantId: availability.merchant.id,
      bookingId,
      provider: "manual",
      method: "manual_bank_transfer",
      status: "pending",
      amountCents: subtotalCents,
      requestReference: `MANUAL-${reference}`,
      expiresAt: paymentDueAt,
      metadata: { source: "guest_checkout" },
    });
  const insertAccessToken = db.insert(bookingAccessTokens).values({
      id: accessTokenId,
      merchantId: availability.merchant.id,
      bookingId,
      tokenHash: tokenHash(accessToken),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
    });
  const insertAllocations = db.insert(courtAllocations).values(
    itemRows.map((item) => ({
      merchantId: item.merchantId,
      courtId: item.courtId,
      kind: "booking" as const,
      bookingItemId: item.id,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      expiresAt: paymentDueAt,
    })),
  );

  try {
    if (reserveImmediately) {
      await db.batch([
        releaseExpiredAllocations,
        insertBooking,
        insertItems,
        insertPayment,
        insertAccessToken,
        insertAllocations,
      ]);
    } else {
      await db.batch([
        releaseExpiredAllocations,
        insertBooking,
        insertItems,
        insertPayment,
        insertAccessToken,
      ]);
    }
  } catch (error) {
    if (isCourtConflict(error)) {
      return { error: "Another customer just reserved one of these times. Please choose an available slot." };
    }
    console.error("Manual booking creation failed", error);
    return { error: "We could not create the booking. Please try again." };
  }

  redirect(
    `/booking/${reference}?token=${encodeURIComponent(accessToken)}`,
  );
}
