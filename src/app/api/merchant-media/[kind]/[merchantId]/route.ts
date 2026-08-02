import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; merchantId: string }> }) {
  const { kind, merchantId } = await params;
  if (kind !== "logo" && kind !== "cover") return new Response("Not found", { status: 404 });
  const [merchant] = await getDb().select({ pathname: kind === "logo" ? merchants.logoPathname : merchants.coverPathname }).from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant?.pathname) return new Response("Not found", { status: 404 });
  const result = await get(merchant.pathname, { access: "private", useCache: true });
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Length": String(result.blob.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
