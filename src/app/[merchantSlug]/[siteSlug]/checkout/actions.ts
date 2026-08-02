"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookingItems,
  bookings,
  courtAllocations,
  payments,
} from "@/db/schema";
import { getSiteAvailability } from "@/lib/booking/availability";
import { syncCurrentUser } from "@/lib/auth/access";
import { ensureCustomerProfile } from "@/lib/customer/profile";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { createMayaDynamicQr, getMayaConfig } from "@/lib/payments/maya";
import { encryptPlatformSecret } from "@/lib/security/encrypted-secret";

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

function bookingOrigin(requestHeaders: Headers) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return url.origin;
      }
    } catch {
      console.warn("APP_URL is invalid; using the request origin instead.");
    }
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const forwardedProtocol = requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const protocol = forwardedProtocol === "http" ? "http" : "https";
    return `${protocol}://${host}`;
  }

  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
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

export async function createBooking(
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
  const submittedFullName = readText(formData, "fullName");
  const submittedEmail = readText(formData, "email").toLowerCase();
  const mobileNumber = readText(formData, "mobileNumber");
  const customerNotes = readText(formData, "customerNotes");
  const paymentMethod = readText(formData, "paymentMethod") === "maya" ? "maya" : "manual";
  const signedInUser = await syncCurrentUser();
  const fullName = submittedFullName || signedInUser?.fullName || "";
  const email = signedInUser?.email ?? submittedEmail;

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
  if (
    !availability ||
    (paymentMethod === "manual" && !availability.site.manualPaymentEnabled) ||
    (paymentMethod === "maya" && !availability.site.onlinePaymentEnabled)
  ) {
    return { error: "The selected payment option is not available for this venue." };
  }
  const mayaConfig = paymentMethod === "maya" ? await getMayaConfig() : null;
  if (paymentMethod === "maya" && !mayaConfig) {
    return { error: "Maya online payment is temporarily unavailable. Choose manual payment or contact the venue." };
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
  let customerId: string | null = null;
  if (signedInUser) {
    try {
      const customer = await ensureCustomerProfile(signedInUser, {
        fullName,
        mobileNumber,
      });
      customerId = customer.id;
    } catch (error) {
      console.error("Customer profile linking failed", error);
      return {
        error:
          "We could not link this booking to your customer account. Verify your email or try again.",
      };
    }
  }
  const now = new Date();
  const paymentDueAt = new Date(now.getTime() + (paymentMethod === "maya" ? 60 : availability.site.manualPaymentDeadlineMinutes) * 60_000);
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
  const reserveImmediately = paymentMethod === "maya" || availability.site.manualReservationMode === "reserve_immediately";
  const platformFeeCents = paymentMethod === "maya"
    ? Math.round(subtotalCents * availability.merchant.gatewayFeeBasisPoints / 10_000)
    : 0;
  const mayaReturnToken = paymentMethod === "maya" ? randomBytes(24).toString("base64url") : null;
  const lastBookedEnd = itemRows[itemRows.length - 1]!.endsAt;
  const accessExpiresAt = new Date(
    Math.max(
      now.getTime() + 90 * 24 * 60 * 60_000,
      lastBookedEnd.getTime() + 30 * 24 * 60 * 60_000,
    ),
  );

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
      customerId,
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
      provider: paymentMethod === "maya" ? "maya" : "manual",
      method: paymentMethod === "maya" ? "maya_qrph" : "manual_bank_transfer",
      status: "pending",
      amountCents: subtotalCents,
      requestReference: `${paymentMethod === "maya" ? "MAYA" : "MANUAL"}-${reference}`,
      gatewayFeeBasisPoints: paymentMethod === "maya" ? availability.merchant.gatewayFeeBasisPoints : 0,
      platformFeeCents,
      expiresAt: paymentDueAt,
      metadata: {
        source: signedInUser ? "customer_checkout" : "guest_checkout",
        ...(mayaReturnToken ? {
          returnTokenHash: tokenHash(mayaReturnToken),
          bookingAccessTokenEncrypted: encryptPlatformSecret(accessToken),
        } : {}),
      },
    });
  const insertAccessToken = db.insert(bookingAccessTokens).values({
      id: accessTokenId,
      merchantId: availability.merchant.id,
      bookingId,
      tokenHash: tokenHash(accessToken),
      expiresAt: accessExpiresAt,
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
    console.error("Booking creation failed", error);
    return { error: "We could not create the booking. Please try again." };
  }

  const requestHeaders = await headers();
  const bookingPath = `/booking/${reference}?token=${encodeURIComponent(accessToken)}`;
  const bookingUrl = new URL(bookingPath, bookingOrigin(requestHeaders)).toString();
  if (paymentMethod === "maya" && mayaConfig && mayaReturnToken) {
    const origin = bookingOrigin(requestHeaders);
    const returnBase = new URL("/payments/maya/return", origin);
    returnBase.searchParams.set("payment", paymentId);
    returnBase.searchParams.set("returnToken", mayaReturnToken);
    try {
      const maya = await createMayaDynamicQr({
        config: mayaConfig,
        amountCents: subtotalCents,
        requestReference: `MAYA-${reference}`,
        redirectUrls: {
          success: `${returnBase.toString()}&result=success`,
          failure: `${returnBase.toString()}&result=failure`,
          cancel: `${returnBase.toString()}&result=cancel`,
        },
        metadata: { bookingReference: reference, merchantId: availability.merchant.id },
      });
      await db.update(payments).set({
        providerPaymentId: maya.paymentId,
        providerStatus: "CREATED",
        metadata: {
          source: signedInUser ? "customer_checkout" : "guest_checkout",
          returnTokenHash: tokenHash(mayaReturnToken),
          bookingAccessTokenEncrypted: encryptPlatformSecret(accessToken),
          mayaRedirectUrl: maya.redirectUrl,
          mayaQrCodeBody: maya.qrCodeBody,
          mayaEnvironment: mayaConfig.environment,
        },
        updatedAt: new Date(),
      }).where(eq(payments.id, paymentId));
    } catch (error) {
      console.error("Maya QR creation failed", error);
      await db.batch([
        db.update(payments).set({ status: "failed", failedAt: new Date(), failureMessage: "Maya could not create the QR payment.", updatedAt: new Date() }).where(eq(payments.id, paymentId)),
        db.update(bookings).set({ status: "cancelled", paymentStatus: "failed", cancelledAt: new Date(), cancellationReason: "Maya checkout could not be started.", updatedAt: new Date() }).where(eq(bookings.id, bookingId)),
        db.update(courtAllocations).set({ active: false, releasedAt: new Date() }).where(and(eq(courtAllocations.merchantId, availability.merchant.id), eq(courtAllocations.active, true), inArray(courtAllocations.bookingItemId, itemRows.map((item) => item.id)))),
      ]);
      return { error: "Maya could not prepare the QR payment. Your court hold was released; please try again." };
    }
  }
  if (process.env.BOOKING_EMAIL_ENABLED === "true") {
    after(async () => {
      try {
        await sendBookingConfirmationEmail({
          bookingId,
          bookingUrl,
          customerEmail: email,
          customerName: fullName,
          reference,
          merchantName: availability.merchant.name,
          siteName: availability.site.name,
          courtName: court.name,
          timezone: availability.site.timezone,
          slots: itemRows.map((item) => ({
            startsAt: item.startsAt,
            endsAt: item.endsAt,
          })),
          totalCents: subtotalCents,
          paymentDueAt,
          manualPaymentInstructions: paymentMethod === "manual" ? availability.site.manualPaymentInstructions : null,
        });
      } catch (error) {
        console.error(`Booking confirmation email failed for ${reference}`, error);
      }
    });
  }

  redirect(bookingPath);
}
