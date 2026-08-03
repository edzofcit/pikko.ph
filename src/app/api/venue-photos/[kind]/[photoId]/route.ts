import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courtPhotos, sitePhotos } from "@/db/schema";
import { storedImageResponse } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; photoId: string }> }) {
  const { kind, photoId } = await params;
  const table = kind === "site" ? sitePhotos : kind === "court" ? courtPhotos : null;
  if (!table) return new Response("Not found", { status: 404 });
  const [photo] = await getDb().select({ pathname: table.pathname }).from(table).where(eq(table.id, photoId)).limit(1);
  if (!photo) return new Response("Not found", { status: 404 });
  return await storedImageResponse(photo.pathname, { cacheControl: "public, max-age=31536000, immutable" }) ?? new Response("Not found", { status: 404 });
}
