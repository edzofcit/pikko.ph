import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { courts, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireMerchantPermission("manage_courts");
  const body = await request.json() as HandleUploadBody;
  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      let payload: { siteId?: string; courtId?: string; photoId?: string; altText?: string };
      try { payload = JSON.parse(clientPayload ?? "{}"); } catch { throw new Error("Invalid upload details."); }
      const siteId = payload.siteId ?? "";
      const courtId = payload.courtId ?? "";
      const photoId = payload.photoId ?? "";
      if (!UUID.test(siteId) || !UUID.test(photoId) || (courtId && !UUID.test(courtId)) || String(payload.altText ?? "").length > 200) throw new Error("Invalid upload details.");
      const db = getDb();
      const [site] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId))).limit(1);
      if (!site || (access.membership.role !== "owner" && !access.sites.some((candidate) => candidate.id === siteId))) throw new Error("You cannot update that site.");
      if (courtId) {
        const [court] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.id, courtId), eq(courts.siteId, siteId), eq(courts.merchantId, access.membership.merchantId))).limit(1);
        if (!court) throw new Error("Court not found.");
      }
      const expected = courtId ? `/courts/${courtId}/${photoId}.` : `/sites/${siteId}/${photoId}.`;
      if (!pathname.includes(expected)) throw new Error("Invalid upload pathname.");
      return { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 8 * 1024 * 1024, addRandomSuffix: false, tokenPayload: JSON.stringify({ siteId, courtId, photoId, altText: String(payload.altText ?? "") }) };
    },
  });
  return NextResponse.json(result);
}
