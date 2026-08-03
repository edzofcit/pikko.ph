import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import {
  isManualPaymentProvider,
  MANUAL_PAYMENT_PROVIDERS,
  normalizeManualPaymentOptions,
} from "@/lib/manual-payment/options";
import { deleteStoredImage, isCloudinaryConfigured, uploadStoredImage } from "@/lib/storage/images";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function venuesUrl(request: Request, kind: "success" | "error", message: string) {
  const siteId = new URL(request.url).pathname.split("/")[4] ?? "";
  const url = new URL("/merchant/sites", request.url);
  if (siteId) url.searchParams.set("site", siteId);
  url.searchParams.set("tab", "settings");
  url.searchParams.set(kind, message);
  return url;
}

function imageSignatureIsValid(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    mimeType === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "QR image must be 3 MB or smaller."),
      303,
    );
  }

  const [{ siteId }, access] = await Promise.all([
    params,
    requireMerchantPermission("manage_courts"),
  ]);
  if (access.membership.role !== "owner" && !access.sites.some((site) => site.id === siteId)) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "You cannot update that site."),
      303,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.redirect(
      venuesUrl(request, "error", "The QR upload could not be read."),
      303,
    );
  }

  const provider = String(formData.get("provider") ?? "");
  const operation = String(formData.get("operation") ?? "upload");
  if (
    !isManualPaymentProvider(provider) ||
    !["upload", "remove", "toggle"].includes(operation)
  ) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "Choose a supported payment option."),
      303,
    );
  }

  const db = getDb();
  const [site] = await db
    .select({
      id: sites.id,
      manualPaymentOptions: sites.manualPaymentOptions,
    })
    .from(sites)
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.merchantId, access.membership.merchantId),
      ),
    )
    .limit(1);
  if (!site) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "Site not found."),
      303,
    );
  }

  const existingOptions = normalizeManualPaymentOptions(site.manualPaymentOptions);
  const existingOption = existingOptions.find((option) => option.provider === provider);
  const providerLabel =
    MANUAL_PAYMENT_PROVIDERS.find((option) => option.id === provider)?.label ??
    provider.toUpperCase();

  if (operation === "toggle") {
    if (!existingOption) {
      return NextResponse.redirect(
        venuesUrl(request, "error", `Upload a ${providerLabel} QR before enabling it.`),
        303,
      );
    }
    const enabled = formData.get("enabled") === "true";
    await db
      .update(sites)
      .set({
        manualPaymentOptions: existingOptions.map((option) =>
          option.provider === provider ? { ...option, enabled } : option,
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.merchantId, access.membership.merchantId),
        ),
      );
    return NextResponse.redirect(
      venuesUrl(
        request,
        "success",
        `${providerLabel} is now ${enabled ? "visible" : "hidden"} at checkout.`,
      ),
      303,
    );
  }

  if (operation === "remove") {
    await db
      .update(sites)
      .set({
        manualPaymentOptions: existingOptions.filter(
          (option) => option.provider !== provider,
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.merchantId, access.membership.merchantId),
        ),
      );
    if (existingOption) {
      await deleteStoredImage(existingOption.qrImagePathname).catch((error) =>
        console.error("Old manual payment QR cleanup failed", error),
      );
    }
    return NextResponse.redirect(
      venuesUrl(request, "success", `${providerLabel} QR removed.`),
      303,
    );
  }

  const image = formData.get("qrImage");
  if (
    !(image instanceof File) ||
    image.size < 1 ||
    image.size > MAX_FILE_BYTES ||
    !ALLOWED_TYPES.has(image.type)
  ) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "Use a JPG, PNG, or WebP QR image up to 3 MB."),
      303,
    );
  }
  if (!isCloudinaryConfigured() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "QR uploads are temporarily unavailable."),
      303,
    );
  }

  const signature = new Uint8Array(await image.slice(0, 16).arrayBuffer());
  if (!imageSignatureIsValid(signature, image.type)) {
    return NextResponse.redirect(
      venuesUrl(request, "error", "The selected file is not a valid image."),
      303,
    );
  }

  const extension = ALLOWED_TYPES.get(image.type)!;
  const storageBase = `manual-payment-qrs/${access.membership.merchantId}/${siteId}/${provider}-${randomUUID()}`;
  const pathname = `${storageBase}.${extension}`;
  let uploadedKey = "";
  try {
    const cloudinaryUpload = await uploadStoredImage(image, storageBase);
    if (cloudinaryUpload) uploadedKey = cloudinaryUpload.storageKey;
    else uploadedKey = (await put(pathname, image, { access: "private", addRandomSuffix: false, contentType: image.type, cacheControlMaxAge: 31_536_000 })).pathname;
    const nextOptions = existingOptions.filter(
      (option) => option.provider !== provider,
    );
    nextOptions.push({
      provider,
      label: providerLabel,
      enabled: existingOption?.enabled ?? true,
      qrImageUrl: `/api/sites/${siteId}/payment-qr/${provider}?v=${encodeURIComponent(uploadedKey)}`,
      qrImagePathname: uploadedKey,
    });
    await db
      .update(sites)
      .set({
        manualPaymentOptions: normalizeManualPaymentOptions(nextOptions),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.merchantId, access.membership.merchantId),
        ),
      );
  } catch (error) {
    if (uploadedKey) {
      await deleteStoredImage(uploadedKey).catch((cleanupError) =>
        console.error("New manual payment QR cleanup failed", cleanupError),
      );
    }
    console.error("Manual payment QR upload failed", error);
    return NextResponse.redirect(
      venuesUrl(request, "error", "The QR image could not be uploaded."),
      303,
    );
  }

  if (existingOption) {
    await deleteStoredImage(existingOption.qrImagePathname).catch((error) =>
      console.error("Replaced manual payment QR cleanup failed", error),
    );
  }
  return NextResponse.redirect(
    venuesUrl(request, "success", `${providerLabel} QR saved.`),
    303,
  );
}
