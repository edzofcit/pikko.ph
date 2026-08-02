import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants, sites } from "@/db/schema";
import {
  isManualPaymentProvider,
  normalizeManualPaymentOptions,
} from "@/lib/manual-payment/options";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ siteId: string; provider: string }> },
) {
  const { siteId, provider } = await params;
  if (!isManualPaymentProvider(provider)) {
    return new Response("Not found", { status: 404 });
  }

  const db = getDb();
  const [site] = await db
    .select({ manualPaymentOptions: sites.manualPaymentOptions })
    .from(sites)
    .innerJoin(merchants, eq(merchants.id, sites.merchantId))
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.status, "active"),
        eq(merchants.status, "active"),
      ),
    )
    .limit(1);
  const option = normalizeManualPaymentOptions(
    site?.manualPaymentOptions,
  ).find((candidate) => candidate.provider === provider);
  if (!option || !process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const result = await get(option.qrImagePathname, {
    access: "private",
    useCache: true,
  });
  if (!result || result.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Length": String(result.blob.size),
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
