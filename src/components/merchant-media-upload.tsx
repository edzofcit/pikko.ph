"use client";

import { useState } from "react";
import { uploadImageFromBrowser } from "@/lib/storage/upload-client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function MerchantMediaUpload({ merchantId, kind, returnTo = "/merchant/public" }: { merchantId: string; kind: "logo" | "cover"; returnTo?: "/merchant/public" | "/merchant/settings" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const label = kind === "logo" ? "logo" : "cover photo";

  async function submit(formData: FormData) {
    const file = formData.get("photo");
    if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(file.type)) {
      setError("Choose a JPG, PNG, or WebP image up to 8 MB.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);
    const mediaId = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const pathname = `merchant-profile/${merchantId}/${kind}/${mediaId}.${extension}`;
    const clientPayload = JSON.stringify({ merchantId, kind, mediaId });

    try {
      const storageKey = await uploadImageFromBrowser({
        file,
        pathname,
        handleUploadUrl: "/api/merchant/profile-media/upload",
        clientPayload,
        onProgress: setProgress,
      });
      const response = await fetch("/api/merchant/profile-media/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId, kind, mediaId, pathname: storageKey }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || `The ${label} could not be saved.`);
      window.location.assign(`${returnTo}?success=${encodeURIComponent(`${kind === "logo" ? "Logo" : "Cover photo"} uploaded.`)}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : `The ${label} could not be uploaded.`);
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="mt-4 space-y-3">
      <label className="block text-xs font-black">
        Replace {label}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} className="mt-2 block w-full text-xs" />
      </label>
      <button disabled={busy} className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">
        {busy ? `Uploading ${progress}%` : `Upload ${label}`}
      </button>
      {error ? <p role="alert" className="text-xs font-bold text-red-700">{error}</p> : null}
    </form>
  );
}
