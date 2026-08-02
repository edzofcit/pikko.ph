import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { bookingAccessTokens, payments } from "@/db/schema";
import { hashBookingAccessToken } from "@/lib/booking/access-token";
import { reconcileMayaPayment } from "@/lib/payments/maya-reconciliation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { paymentId?: string; token?: string } | null;
  if (!body?.paymentId || !body.token || body.token.length > 1000) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const db = getDb();
  const [payment] = await db
    .select({ providerPaymentId: payments.providerPaymentId })
    .from(payments)
    .innerJoin(bookingAccessTokens, eq(bookingAccessTokens.bookingId, payments.bookingId))
    .where(and(
      eq(payments.id, body.paymentId),
      eq(payments.provider, "maya"),
      eq(bookingAccessTokens.tokenHash, hashBookingAccessToken(body.token)),
      gt(bookingAccessTokens.expiresAt, new Date()),
      isNull(bookingAccessTokens.revokedAt),
    ))
    .limit(1);
  if (!payment?.providerPaymentId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  try {
    const result = await reconcileMayaPayment(payment.providerPaymentId);
    return NextResponse.json({ outcome: result.outcome });
  } catch (error) {
    console.error("Maya status refresh failed", error);
    return NextResponse.json({ outcome: "pending" }, { status: 503 });
  }
}
