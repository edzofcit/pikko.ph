import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processSubscriptionBilling } from "@/lib/billing/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.VERCEL_ENV !== "production";
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processSubscriptionBilling();
  return NextResponse.json({ ok: true, ...result });
}
