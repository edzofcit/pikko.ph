"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function VenuePhotoUpload({ siteId, courtId }: { siteId: string; courtId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  async function submit(formData: FormData) {
    const file = formData.get("photo");
    const altText = String(formData.get("altText") ?? "").trim();
    if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPG, PNG, or WebP image up to 8 MB.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    const photoId = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const entityPath = courtId ? `courts/${courtId}` : `sites/${siteId}`;
    const pathname = `merchant-media/${siteId}/${entityPath}/${photoId}.${extension}`;
    const payload = JSON.stringify({ siteId, courtId: courtId ?? "", photoId, altText });
    try {
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/merchant/venue-photos/upload",
        clientPayload: payload,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const response = await fetch("/api/merchant/venue-photos/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, courtId: courtId ?? "", photoId, altText, pathname: blob.pathname }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The photo could not be saved.");
      window.location.assign(`/merchant/sites?site=${encodeURIComponent(siteId)}&tab=photos&success=${encodeURIComponent("Photo uploaded.")}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The photo could not be uploaded.");
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[var(--line)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-xs font-black">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} className="mt-1.5 block w-full text-xs" /></label>
      <label className="text-xs font-black">Alt text<input name="altText" maxLength={200} disabled={busy} placeholder="Describe the photo" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
      <button disabled={busy} className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">{busy ? `Uploading ${progress}%` : "Upload"}</button>
      {error ? <p role="alert" className="text-xs font-bold text-red-700 sm:col-span-3">{error}</p> : null}
    </form>
  );
}
