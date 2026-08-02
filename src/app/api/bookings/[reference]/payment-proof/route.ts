import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookings,
  customers,
  manualPaymentProofs,
  payments,
} from "@/db/schema";
import { hashBookingAccessToken } from "@/lib/booking/access-token";
import { syncCurrentUser } from "@/lib/auth/access";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function bookingUrl(request: Request, reference: string, token: string) {
  const url = new URL(`/booking/${encodeURIComponent(reference)}`, request.url);
  if (token) url.searchParams.set("token", token);
  return url;
}

function redirectWithMessage(
  request: Request,
  reference: string,
  token: string,
  key: "uploaded" | "error",
  value: string,
) {
  const url = bookingUrl(request, reference, token);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The screenshot is too large." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const token = String(formData.get("token") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const screenshot = formData.get("screenshot");

  if (token.length > 1000) {
    return NextResponse.json({ error: "Invalid booking access." }, { status: 401 });
  }
  if (!(screenshot instanceof File)) {
    return redirectWithMessage(request, reference, token, "error", "Choose a payment screenshot.");
  }
  if (
    screenshot.size < 1 ||
    screenshot.size > MAX_FILE_BYTES ||
    !ALLOWED_TYPES.has(screenshot.type)
  ) {
    return redirectWithMessage(
      request,
      reference,
      token,
      "error",
      "Use a JPG, PNG, or WebP image up to 3 MB.",
    );
  }
  if (notes.length > 500) {
    return redirectWithMessage(request, reference, token, "error", "Notes must be 500 characters or fewer.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not configured");
    return redirectWithMessage(request, reference, token, "error", "Screenshot uploads are temporarily unavailable.");
  }

  const db = getDb();
  const now = new Date();
  const bookingFields = {
    id: bookings.id,
    merchantId: bookings.merchantId,
    status: bookings.status,
    paymentStatus: bookings.paymentStatus,
    paymentId: payments.id,
    paymentProvider: payments.provider,
  };
  type BookingRow = {
    id: string;
    merchantId: string;
    status: (typeof bookings.$inferSelect)["status"];
    paymentStatus: (typeof bookings.$inferSelect)["paymentStatus"];
    paymentId: string;
    paymentProvider: (typeof payments.$inferSelect)["provider"];
  };
  let booking: BookingRow | undefined;

  if (token) {
    [booking] = await db
      .select(bookingFields)
      .from(bookingAccessTokens)
      .innerJoin(
        bookings,
        and(
          eq(bookings.id, bookingAccessTokens.bookingId),
          eq(bookings.merchantId, bookingAccessTokens.merchantId),
        ),
      )
      .innerJoin(
        payments,
        and(
          eq(payments.bookingId, bookings.id),
          eq(payments.merchantId, bookings.merchantId),
          eq(payments.provider, "manual"),
        ),
      )
      .where(
        and(
          eq(bookings.reference, reference),
          eq(bookingAccessTokens.tokenHash, hashBookingAccessToken(token)),
          gt(bookingAccessTokens.expiresAt, now),
          isNull(bookingAccessTokens.revokedAt),
        ),
      )
      .limit(1);
  } else {
    const user = await syncCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.userId, user.id))
      .limit(1);
    const ownership = customer
      ? user.emailVerifiedAt
        ? or(
            eq(bookings.customerId, customer.id),
            sql`lower(${bookings.customerEmail}) = ${user.email}`,
          )
        : eq(bookings.customerId, customer.id)
      : user.emailVerifiedAt
        ? sql`lower(${bookings.customerEmail}) = ${user.email}`
        : null;
    if (!ownership) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    [booking] = await db
      .select(bookingFields)
      .from(bookings)
      .innerJoin(
        payments,
        and(
          eq(payments.bookingId, bookings.id),
          eq(payments.merchantId, bookings.merchantId),
          eq(payments.provider, "manual"),
        ),
      )
      .where(and(eq(bookings.reference, reference), ownership))
      .limit(1);
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (
    booking.paymentProvider !== "manual" ||
    !["pending_payment", "pending_verification"].includes(booking.status) ||
    booking.paymentStatus === "paid"
  ) {
    return redirectWithMessage(request, reference, token, "error", "This booking is not accepting payment proofs.");
  }

  const extension = ALLOWED_TYPES.get(screenshot.type)!;
  const storagePath = `manual-payment-proofs/${booking.merchantId}/${booking.id}/${randomUUID()}.${extension}`;
  let uploaded: Awaited<ReturnType<typeof put>> | null = null;

  try {
    uploaded = await put(storagePath, screenshot, {
      access: "private",
      addRandomSuffix: false,
      contentType: screenshot.type,
      cacheControlMaxAge: 60,
    });
    await db.batch([
      db.insert(manualPaymentProofs).values({
        merchantId: booking.merchantId,
        bookingId: booking.id,
        paymentId: booking.paymentId,
        storageKey: uploaded.pathname,
        originalFilename: screenshot.name.slice(0, 255) || `payment-proof.${extension}`,
        mimeType: screenshot.type,
        sizeBytes: screenshot.size,
        customerNotes: notes || null,
      }),
      db
        .update(bookings)
        .set({ status: "pending_verification", paymentStatus: "pending", updatedAt: now })
        .where(eq(bookings.id, booking.id)),
      db
        .update(payments)
        .set({ status: "pending", failedAt: null, failureCode: null, failureMessage: null, updatedAt: now })
        .where(eq(payments.id, booking.paymentId)),
    ]);
  } catch (error) {
    if (uploaded) {
      await del(uploaded.pathname).catch((cleanupError) =>
        console.error("Payment proof cleanup failed", cleanupError),
      );
    }
    console.error("Payment proof upload failed", error);
    return redirectWithMessage(request, reference, token, "error", "We could not upload the screenshot. Please try again.");
  }

  return redirectWithMessage(request, reference, token, "uploaded", "1");
}
