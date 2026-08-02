import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courtPhotos, sitePhotos } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; photoId: string }> }) {
  const { kind, photoId } = await params;
  const table = kind === "site" ? sitePhotos : kind === "court" ? courtPhotos : null;
  if (!table) return new Response("Not found", { status: 404 });
  const [photo] = await getDb().select({ pathname: table.pathname }).from(table).where(eq(table.id, photoId)).limit(1);
  if (!photo) return new Response("Not found", { status: 404 });
  const result = await get(photo.pathname, { access: "private", useCache: true });
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
  return new Response(result.stream, { headers: { "Content-Type": result.blob.contentType || "application/octet-stream", "Content-Length": String(result.blob.size), "Cache-Control": "public, max-age=31536000, immutable", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
