import { del, get, head } from "@vercel/blob";
import { v2 as cloudinary } from "cloudinary";

const CLOUDINARY_PREFIX = "cloudinary:";
const CLOUDINARY_AUTH_PREFIX = "cloudinary-auth:";

function configureCloudinary() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;
  if ((!cloudName || !apiKey || !apiSecret) && process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      if (url.protocol === "cloudinary:") {
        cloudName = decodeURIComponent(url.hostname);
        apiKey = decodeURIComponent(url.username);
        apiSecret = decodeURIComponent(url.password);
      }
    } catch { /* fall through to the configuration check */ }
  }
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

function parseCloudinaryKey(storageKey: string) {
  if (storageKey.startsWith(CLOUDINARY_AUTH_PREFIX)) {
    return { publicId: storageKey.slice(CLOUDINARY_AUTH_PREFIX.length), type: "authenticated" as const };
  }
  if (storageKey.startsWith(CLOUDINARY_PREFIX)) {
    return { publicId: storageKey.slice(CLOUDINARY_PREFIX.length), type: "upload" as const };
  }
  return null;
}

function contentTypeForFormat(format?: string) {
  if (format === "jpg" || format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "application/octet-stream";
}

export function isCloudinaryConfigured() {
  return Boolean(configureCloudinary());
}

export function cloudinaryStorageKey(publicId: string, authenticated = false) {
  return `${authenticated ? CLOUDINARY_AUTH_PREFIX : CLOUDINARY_PREFIX}${publicId}`;
}

export function storageKeyMatchesBase(storageKey: string, base: string) {
  const parsed = parseCloudinaryKey(storageKey);
  return parsed ? parsed.publicId === `pikko/${base}` : storageKey.startsWith(`${base}.`);
}

export function createDirectImageUpload(publicId: string) {
  const config = configureCloudinary();
  if (!config) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadPublicId = `pikko/${publicId}`;
  const params = { allowed_formats: "jpg,png,webp", invalidate: true, overwrite: true, public_id: uploadPublicId, timestamp };
  return {
    provider: "cloudinary" as const,
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    publicId: uploadPublicId,
    signature: cloudinary.utils.api_sign_request(params, config.apiSecret),
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
  };
}

export async function inspectStoredImage(storageKey: string) {
  const parsed = parseCloudinaryKey(storageKey);
  if (parsed) {
    if (!configureCloudinary()) return null;
    const resource = await cloudinary.api.resource(parsed.publicId, {
      resource_type: "image",
      type: parsed.type,
    }).catch(() => null);
    if (!resource) return null;
    return {
      size: Number(resource.bytes ?? 0),
      contentType: contentTypeForFormat(resource.format),
    };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const blob = await head(storageKey).catch(() => null);
  return blob ? { size: blob.size, contentType: blob.contentType } : null;
}

export async function uploadStoredImage(
  file: File,
  publicId: string,
  options: { authenticated?: boolean } = {},
) {
  if (configureCloudinary()) {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const type = options.authenticated ? "authenticated" : "upload";
    const result = await cloudinary.uploader.upload(`data:${file.type};base64,${data}`, {
      public_id: `pikko/${publicId}`,
      resource_type: "image",
      type,
      overwrite: true,
      invalidate: true,
      allowed_formats: ["jpg", "png", "webp"],
    });
    return {
      storageKey: cloudinaryStorageKey(result.public_id, options.authenticated),
      size: result.bytes,
      contentType: contentTypeForFormat(result.format),
    };
  }
  return null;
}

export async function deleteStoredImage(storageKey: string) {
  const parsed = parseCloudinaryKey(storageKey);
  if (parsed) {
    if (!configureCloudinary()) return;
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: "image",
      type: parsed.type,
      invalidate: true,
    });
    return;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) await del(storageKey);
}

export async function storedImageResponse(
  storageKey: string,
  options: { cacheControl: string; fallbackContentType?: string },
) {
  const parsed = parseCloudinaryKey(storageKey);
  if (parsed) {
    if (!configureCloudinary()) return null;
    const url = cloudinary.url(parsed.publicId, {
      secure: true,
      sign_url: parsed.type === "authenticated",
      type: parsed.type,
      resource_type: "image",
    });
    const response = await fetch(url, { cache: parsed.type === "authenticated" ? "no-store" : "force-cache" });
    if (!response.ok || !response.body) return null;
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || options.fallbackContentType || "application/octet-stream",
        ...(response.headers.get("content-length") ? { "Content-Length": response.headers.get("content-length")! } : {}),
        "Cache-Control": options.cacheControl,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const result = await get(storageKey, { access: "private", useCache: !options.cacheControl.includes("no-store") });
  if (!result || result.statusCode !== 200) return null;
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || options.fallbackContentType || "application/octet-stream",
      "Content-Length": String(result.blob.size),
      "Cache-Control": options.cacheControl,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
