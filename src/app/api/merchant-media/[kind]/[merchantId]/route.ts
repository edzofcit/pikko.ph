import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";
import { storedImageResponse } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; merchantId: string }> }) {
  const { kind, merchantId } = await params;
  if (kind !== "logo" && kind !== "cover") return new Response("Not found", { status: 404 });
  const [merchant] = await getDb().select({ pathname: kind === "logo" ? merchants.logoPathname : merchants.coverPathname }).from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant?.pathname) return new Response("Not found", { status: 404 });
  return await storedImageResponse(merchant.pathname, { cacheControl: "public, max-age=31536000, immutable" }) ?? new Response("Not found", { status: 404 });
}
