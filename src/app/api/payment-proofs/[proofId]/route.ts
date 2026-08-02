import { get } from "@vercel/blob";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookings,
  manualPaymentProofs,
} from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { hashBookingAccessToken } from "@/lib/booking/access-token";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ proofId: string }> },
) {
  const { proofId } = await params;
  if (!UUID_PATTERN.test(proofId)) return new Response("Not found", { status: 404 });
  const db = getDb();
  const [proof] = await db
    .select({
      id: manualPaymentProofs.id,
      bookingId: manualPaymentProofs.bookingId,
      merchantId: manualPaymentProofs.merchantId,
      storageKey: manualPaymentProofs.storageKey,
      mimeType: manualPaymentProofs.mimeType,
      siteId: bookings.siteId,
    })
    .from(manualPaymentProofs)
    .innerJoin(bookings, eq(bookings.id, manualPaymentProofs.bookingId))
    .where(eq(manualPaymentProofs.id, proofId))
    .limit(1);

  if (!proof) return new Response("Not found", { status: 404 });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  let authorized = false;
  if (token && token.length <= 1000) {
    const [guestAccess] = await db
      .select({ id: bookingAccessTokens.id })
      .from(bookingAccessTokens)
      .where(
        and(
          eq(bookingAccessTokens.bookingId, proof.bookingId),
          eq(bookingAccessTokens.merchantId, proof.merchantId),
          eq(bookingAccessTokens.tokenHash, hashBookingAccessToken(token)),
          gt(bookingAccessTokens.expiresAt, new Date()),
          isNull(bookingAccessTokens.revokedAt),
        ),
      )
      .limit(1);
    authorized = Boolean(guestAccess);
  } else {
    const access = await getMerchantAccess();
    authorized = Boolean(
      access?.membership?.merchantId === proof.merchantId &&
        access.sites.some((site) => site.id === proof.siteId) &&
        access.permissions.some(
          (permission) =>
            permission === "verify_payments" || permission === "manage_bookings",
        ),
    );
  }

  if (!authorized) return new Response("Not found", { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Storage unavailable", { status: 503 });
  }

  const result = await get(proof.storageKey, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || proof.mimeType,
      "Content-Length": String(result.blob.size),
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
