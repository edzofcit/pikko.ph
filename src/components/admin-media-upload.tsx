"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

export function AdminMediaUpload({ merchantId, kind, targetId }: { merchantId: string; kind: "logo" | "cover" | "site" | "court"; targetId?: string }) {
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState("");
  async function submit(formData: FormData) {
    const file = formData.get("photo"); const altText = String(formData.get("altText") ?? "").trim();
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG, or WebP image up to 8 MB."); return; }
    setBusy(true); setError(""); setProgress(0); const mediaId = crypto.randomUUID(); const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; const entity = targetId ?? merchantId; const pathname = `admin-media/${merchantId}/${kind}/${entity}/${mediaId}.${extension}`; const payload = { merchantId, kind, targetId: targetId ?? "", mediaId, altText };
    try {
      const blob = await upload(pathname, file, { access: "private", handleUploadUrl: "/api/admin/media/upload", clientPayload: JSON.stringify(payload), onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)) });
      const response = await fetch("/api/admin/media/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, pathname: blob.pathname }) }); const result = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(result.error || "The image could not be saved.");
      window.location.assign(`/admin/merchants/${merchantId}?success=${encodeURIComponent("Photo uploaded and set as the current cover.")}`);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "The image could not be uploaded."); setBusy(false); }
  }
  return <form action={submit} className="mt-3 grid gap-3 rounded-xl border border-dashed border-[var(--line)] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs font-black">Image<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} className="mt-2 block w-full text-xs" /></label><label className="text-xs font-black">Alt text<input name="altText" maxLength={200} disabled={busy} className="mt-2 w-full rounded-lg border px-3 py-2 font-normal" /></label><button disabled={busy} className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">{busy ? `Uploading ${progress}%` : "Upload"}</button>{error ? <p role="alert" className="text-xs font-bold text-red-700 sm:col-span-3">{error}</p> : null}</form>;
}
