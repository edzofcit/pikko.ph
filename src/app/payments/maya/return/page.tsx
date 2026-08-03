import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { getDb } from "@/db";
import { bookings, payments } from "@/db/schema";
import { reconcileMayaPayment } from "@/lib/payments/maya-reconciliation";
import { decryptPlatformSecret } from "@/lib/security/encrypted-secret";

export const dynamic = "force-dynamic";

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function equalHash(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function MayaReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; returnToken?: string }>;
}) {
  const query = await searchParams;
  if (!query.payment || !query.returnToken || query.returnToken.length > 200) notFound();
  const db = getDb();
  const [row] = await db
    .select({
      providerPaymentId: payments.providerPaymentId,
      metadata: payments.metadata,
      bookingReference: bookings.reference,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(eq(payments.id, query.payment))
    .limit(1);
  const expectedHash = String(row?.metadata?.returnTokenHash ?? "");
  if (!row?.providerPaymentId || !expectedHash || !equalHash(tokenHash(query.returnToken), expectedHash)) notFound();

  let result: "paid" | "pending" | "failed" = "pending";
  try {
    const reconciliation = await reconcileMayaPayment(row.providerPaymentId);
    if (reconciliation.outcome === "paid") result = "paid";
    if (reconciliation.outcome === "failed") result = "failed";
  } catch (error) {
    console.error("Maya return reconciliation failed", error);
  }
  const encryptedAccessToken = String(row.metadata?.bookingAccessTokenEncrypted ?? "");
  if (!encryptedAccessToken) notFound();
  const accessToken = decryptPlatformSecret(encryptedAccessToken);
  redirect(`/booking/${row.bookingReference}?token=${encodeURIComponent(accessToken)}&maya=${result}`);
}
