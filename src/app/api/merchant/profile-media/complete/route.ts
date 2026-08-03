import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { deleteStoredImage, inspectStoredImage, storageKeyMatchesBase } from "@/lib/storage/images";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const access = await requireMerchantPermission("manage_courts");
  if (access.membership.role !== "owner") return NextResponse.json({ error: "Only merchant owners can update this page." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as null | { merchantId?: string; kind?: string; mediaId?: string; pathname?: string };
  const merchantId = body?.merchantId ?? "";
  const kind = body?.kind ?? "";
  const mediaId = body?.mediaId ?? "";
  const pathname = body?.pathname ?? "";
  const expectedBase = `merchant-profile/${merchantId}/${kind}/${mediaId}`;
  if (merchantId !== access.membership.merchantId || !UUID.test(mediaId) || !new Set(["logo", "cover"]).has(kind) || !storageKeyMatchesBase(pathname, expectedBase)) {
    return NextResponse.json({ error: "Invalid image details." }, { status: 400 });
  }
  const image = await inspectStoredImage(pathname);
  if (!image || image.size > 8 * 1024 * 1024 || !TYPES.has(image.contentType)) { await deleteStoredImage(pathname).catch(() => undefined); return NextResponse.json({ error: "The uploaded file is not a supported image." }, { status: 400 }); }

  const db = getDb();
  const [merchant] = await db.select({ slug: merchants.slug, oldPathname: kind === "logo" ? merchants.logoPathname : merchants.coverPathname }).from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) return NextResponse.json({ error: "Merchant not found." }, { status: 404 });
  const url = `/api/merchant-media/${kind}/${merchantId}?v=${mediaId}`;
  try {
    await db.batch([
      db.update(merchants).set(kind === "logo" ? { logoUrl: url, logoPathname: pathname, updatedAt: new Date() } : { coverUrl: url, coverPathname: pathname, updatedAt: new Date() }).where(eq(merchants.id, merchantId)),
      db.insert(auditEvents).values({ merchantId, actorUserId: access.user.id, action: `merchant.${kind}_updated`, targetType: "merchant", targetId: merchantId, after: { pathname } }),
    ]);
  } catch (error) {
    await deleteStoredImage(pathname).catch((cleanupError) => console.error("Merchant media cleanup failed", cleanupError));
    console.error("Merchant media completion failed", error);
    return NextResponse.json({ error: "The image was uploaded but could not be saved." }, { status: 500 });
  }
  if (merchant.oldPathname && merchant.oldPathname !== pathname) await deleteStoredImage(merchant.oldPathname).catch((error) => console.error("Old merchant media cleanup failed", error));
  revalidatePath("/merchant/public");
  revalidatePath("/merchant/settings");
  revalidatePath(`/${merchant.slug}`);
  return NextResponse.json({ url });
}
