import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { reconcileMayaPayment } from "@/lib/payments/maya-reconciliation";

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const providerPaymentId = String(payload.id ?? payload.paymentId ?? "");
  if (!providerPaymentId || providerPaymentId.length > 200) {
    return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
  }

  try {
    // The webhook body is never trusted as proof of payment. Reconciliation
    // retrieves the transaction directly from Maya with the secret API key.
    const result = await reconcileMayaPayment(providerPaymentId);
    return NextResponse.json({ received: true, outcome: result.outcome, digest: createHash("sha256").update(raw).digest("hex").slice(0, 12) });
  } catch (error) {
    console.error("Maya webhook reconciliation failed", error);
    return NextResponse.json({ received: false }, { status: 503 });
  }
}
