import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireMerchantPermission } from "@/lib/auth/access";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const access = await requireMerchantPermission("manage_courts");
  if (access.membership.role !== "owner") return NextResponse.json({ error: "Only merchant owners can update this page." }, { status: 403 });
  const body = (await request.json()) as HandleUploadBody;
  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      let payload: { merchantId?: string; kind?: string; mediaId?: string };
      try { payload = JSON.parse(clientPayload ?? "{}"); } catch { throw new Error("Invalid upload details."); }
      const merchantId = payload.merchantId ?? "";
      const kind = payload.kind ?? "";
      const mediaId = payload.mediaId ?? "";
      if (merchantId !== access.membership.merchantId || !UUID.test(mediaId) || !new Set(["logo", "cover"]).has(kind)) throw new Error("Invalid upload details.");
      const expectedPrefix = `merchant-profile/${merchantId}/${kind}/${mediaId}.`;
      if (!pathname.startsWith(expectedPrefix)) throw new Error("Invalid upload pathname.");
      return {
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: 8 * 1024 * 1024,
        addRandomSuffix: false,
        tokenPayload: JSON.stringify({ merchantId, kind, mediaId }),
      };
    },
  });
  return NextResponse.json(result);
}
