import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { courts, merchants, sites } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { createDirectImageUpload } from "@/lib/storage/images";

export const runtime = "nodejs"; const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  await requirePlatformAdmin(); const body = await request.json() as HandleUploadBody & { action?: string; pathname?: string; clientPayload?: string };
  if (body.action === "cloudinary-sign") {
    let payload: { merchantId?: string; kind?: string; targetId?: string; mediaId?: string; altText?: string };
    try { payload = JSON.parse(body.clientPayload ?? "{}"); } catch { return NextResponse.json({ error: "Invalid upload details." }, { status: 400 }); }
    const merchantId = payload.merchantId ?? ""; const kind = payload.kind ?? ""; const targetId = payload.targetId ?? ""; const mediaId = payload.mediaId ?? "";
    if (!UUID.test(merchantId) || !UUID.test(mediaId) || !["logo", "cover", "site", "court"].includes(kind) || String(payload.altText ?? "").length > 200) return NextResponse.json({ error: "Invalid upload details." }, { status: 400 });
    const db = getDb(); const [merchant] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.id, merchantId)).limit(1); if (!merchant) return NextResponse.json({ error: "Merchant not found." }, { status: 404 });
    if (kind === "site") { const [site] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.id, targetId), eq(sites.merchantId, merchantId))).limit(1); if (!site) return NextResponse.json({ error: "Site not found." }, { status: 404 }); }
    if (kind === "court") { const [court] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.id, targetId), eq(courts.merchantId, merchantId))).limit(1); if (!court) return NextResponse.json({ error: "Court not found." }, { status: 404 }); }
    const entity = targetId || merchantId; const expectedBase = `admin-media/${merchantId}/${kind}/${entity}/${mediaId}`;
    if (!body.pathname?.startsWith(`${expectedBase}.`)) return NextResponse.json({ error: "Invalid upload pathname." }, { status: 400 });
    return NextResponse.json(createDirectImageUpload(expectedBase) ?? { provider: "vercel" });
  }
  const result = await handleUpload({ request, body, onBeforeGenerateToken: async (pathname, clientPayload) => {
    const payload = JSON.parse(clientPayload ?? "{}") as { merchantId?: string; kind?: string; targetId?: string; mediaId?: string; altText?: string }; const merchantId = payload.merchantId ?? ""; const kind = payload.kind ?? ""; const targetId = payload.targetId ?? ""; const mediaId = payload.mediaId ?? "";
    if (!UUID.test(merchantId) || !UUID.test(mediaId) || !["logo", "cover", "site", "court"].includes(kind) || String(payload.altText ?? "").length > 200) throw new Error("Invalid upload details.");
    const db = getDb(); const [merchant] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.id, merchantId)).limit(1); if (!merchant) throw new Error("Merchant not found.");
    if (kind === "site") { const [site] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.id, targetId), eq(sites.merchantId, merchantId))).limit(1); if (!site) throw new Error("Site not found."); }
    if (kind === "court") { const [court] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.id, targetId), eq(courts.merchantId, merchantId))).limit(1); if (!court) throw new Error("Court not found."); }
    const entity = targetId || merchantId; if (!pathname.startsWith(`admin-media/${merchantId}/${kind}/${entity}/${mediaId}.`)) throw new Error("Invalid upload pathname.");
    return { allowedContentTypes: ["image/jpeg", "image/png", "image/webp"], maximumSizeInBytes: 8 * 1024 * 1024, addRandomSuffix: false, tokenPayload: JSON.stringify(payload) };
  }}); return NextResponse.json(result);
}
