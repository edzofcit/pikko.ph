"use client";

import { upload } from "@vercel/blob/client";

type UploadOptions = {
  file: File;
  pathname: string;
  handleUploadUrl: string;
  clientPayload: string;
  onProgress: (percentage: number) => void;
};

type SignResponse = {
  provider?: "cloudinary" | "vercel";
  error?: string;
  apiKey?: string;
  timestamp?: number;
  publicId?: string;
  signature?: string;
  uploadUrl?: string;
};

export async function uploadImageFromBrowser(options: UploadOptions) {
  const signResponse = await fetch(options.handleUploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cloudinary-sign", pathname: options.pathname, clientPayload: options.clientPayload }),
  });
  const sign = (await signResponse.json().catch(() => ({}))) as SignResponse;
  if (!signResponse.ok) throw new Error(sign.error || "The upload could not be authorized.");

  if (sign.provider !== "cloudinary") {
    const blob = await upload(options.pathname, options.file, {
      access: "private",
      handleUploadUrl: options.handleUploadUrl,
      clientPayload: options.clientPayload,
      onUploadProgress: ({ percentage }) => options.onProgress(Math.round(percentage)),
    });
    return blob.pathname;
  }

  if (!sign.uploadUrl || !sign.apiKey || !sign.timestamp || !sign.publicId || !sign.signature) {
    throw new Error("Cloudinary upload configuration is incomplete.");
  }
  return new Promise<string>((resolve, reject) => {
    const body = new FormData();
    body.set("file", options.file);
    body.set("api_key", sign.apiKey!);
    body.set("timestamp", String(sign.timestamp));
    body.set("public_id", sign.publicId!);
    body.set("signature", sign.signature!);
    body.set("overwrite", "true");
    body.set("invalidate", "true");
    body.set("allowed_formats", "jpg,png,webp");

    const request = new XMLHttpRequest();
    request.open("POST", sign.uploadUrl!);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The image could not be uploaded to Cloudinary."));
    request.onload = () => {
      let result: { public_id?: string; error?: { message?: string } } = {};
      try { result = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300 || !result.public_id) {
        reject(new Error(result.error?.message || "The image could not be uploaded to Cloudinary."));
        return;
      }
      options.onProgress(100);
      resolve(`cloudinary:${result.public_id}`);
    };
    request.send(body);
  });
}
