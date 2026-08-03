import { and, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, courtPhotos, courts, sitePhotos, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { deleteStoredImage, inspectStoredImage, storageKeyMatchesBase } from "@/lib/storage/images";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireMerchantPermission("manage_courts");
  const body = await request.json().catch(() => null) as null | { siteId?: string; courtId?: string; photoId?: string; altText?: string; pathname?: string };
  const siteId = body?.siteId ?? ""; const courtId = body?.courtId ?? ""; const photoId = body?.photoId ?? ""; const altText = String(body?.altText ?? "").trim(); const pathname = body?.pathname ?? "";
  if (!UUID.test(siteId) || !UUID.test(photoId) || (courtId && !UUID.test(courtId)) || altText.length > 200 || !pathname) return NextResponse.json({ error: "Invalid photo details." }, { status: 400 });
  const db = getDb();
  const [site] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId))).limit(1);
  if (!site || (access.membership.role !== "owner" && !access.sites.some((candidate) => candidate.id === siteId))) return NextResponse.json({ error: "You cannot update that site." }, { status: 403 });
  if (courtId) {
    const [court] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.id, courtId), eq(courts.siteId, siteId), eq(courts.merchantId, access.membership.merchantId))).limit(1);
    if (!court) return NextResponse.json({ error: "Court not found." }, { status: 404 });
  }
  const entityPath = courtId ? `courts/${courtId}` : `sites/${siteId}`;
  const expectedBase = `merchant-media/${siteId}/${entityPath}/${photoId}`;
  if (!storageKeyMatchesBase(pathname, expectedBase)) return NextResponse.json({ error: "Invalid photo path." }, { status: 400 });
  const image = await inspectStoredImage(pathname);
  if (!image || image.size > 8 * 1024 * 1024 || !TYPES.has(image.contentType)) { await deleteStoredImage(pathname).catch(() => undefined); return NextResponse.json({ error: "The uploaded file is not a supported image." }, { status: 400 }); }
  const table = courtId ? courtPhotos : sitePhotos;
  const entityColumn = courtId ? courtPhotos.courtId : sitePhotos.siteId;
  const entityId = courtId || siteId;
  const [{ lastOrder }] = await db.select({ lastOrder: max(table.sortOrder) }).from(table).where(eq(entityColumn, entityId));
  const [{ count }] = await db.select({ count: max(table.sortOrder) }).from(table).where(eq(entityColumn, entityId));
  const url = `/api/venue-photos/${courtId ? "court" : "site"}/${photoId}`;
  try {
    if (courtId) await db.insert(courtPhotos).values({ id: photoId, merchantId: access.membership.merchantId, courtId, url, pathname, altText: altText || null, isCover: count === null, sortOrder: (lastOrder ?? -1) + 1, createdByUserId: access.user.id });
    else await db.insert(sitePhotos).values({ id: photoId, merchantId: access.membership.merchantId, siteId, url, pathname, altText: altText || null, isCover: count === null, sortOrder: (lastOrder ?? -1) + 1, createdByUserId: access.user.id });
    await db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "venue_photo.uploaded", targetType: courtId ? "court" : "site", targetId: entityId, after: { pathname, altText } });
  } catch (error) {
    await deleteStoredImage(pathname).catch((cleanupError) => console.error("Venue photo cleanup failed", cleanupError));
    console.error("Venue photo completion failed", error);
    return NextResponse.json({ error: "The photo was uploaded but could not be added to the site." }, { status: 500 });
  }
  return NextResponse.json({ url });
}
