import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { decryptPlatformSecret } from "@/lib/security/encrypted-secret";

export type MayaEnvironment = "sandbox" | "production";

export type MayaConfig = {
  environment: MayaEnvironment;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
};

export type MayaDynamicQr = {
  paymentId: string;
  redirectUrl: string;
  qrCodeBody: string;
  raw: Record<string, unknown>;
};

export class MayaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MayaApiError";
  }
}

function apiBase(environment: MayaEnvironment) {
  return environment === "production"
    ? "https://pg.paymaya.com"
    : "https://pg-sandbox.paymaya.com";
}

export async function getMayaConfig({ requireEnabled = true } = {}) {
  const db = getDb();
  const [settings] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, "default"))
    .limit(1);
  if (!settings || (requireEnabled && !settings.mayaEnabled)) return null;
  if (!settings.mayaPublicKeyEncrypted || !settings.mayaSecretKeyEncrypted) return null;
  const environment = settings.mayaEnvironment === "production" ? "production" : "sandbox";
  try {
    return {
      environment,
      publicKey: decryptPlatformSecret(settings.mayaPublicKeyEncrypted),
      secretKey: decryptPlatformSecret(settings.mayaSecretKeyEncrypted),
      baseUrl: apiBase(environment),
    } satisfies MayaConfig;
  } catch (error) {
    console.error("Maya credentials could not be decrypted", error);
    return null;
  }
}

async function mayaRequest(
  config: MayaConfig,
  path: string,
  key: "public" | "secret",
  init: RequestInit = {},
) {
  const apiKey = key === "public" ? config.publicKey : config.secretKey;
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = String(payload.code ?? payload.errorCode ?? "") || undefined;
    const detail = String(payload.message ?? payload.error ?? "Maya rejected the request.");
    throw new MayaApiError(detail, response.status, code);
  }
  return payload;
}

export async function createMayaDynamicQr(input: {
  config: MayaConfig;
  amountCents: number;
  requestReference: string;
  redirectUrls: { success: string; failure: string; cancel: string };
  metadata?: Record<string, string>;
}): Promise<MayaDynamicQr> {
  const payload = await mayaRequest(
    input.config,
    "/payments/v1/qr/payments",
    "public",
    {
      method: "POST",
      body: JSON.stringify({
        totalAmount: {
          value: Number((input.amountCents / 100).toFixed(2)),
          currency: "PHP",
        },
        redirectUrl: input.redirectUrls,
        requestReferenceNumber: input.requestReference,
        metadata: input.metadata ?? {},
      }),
    },
  );
  const paymentId = String(payload.paymentId ?? payload.id ?? "");
  const redirectUrl = String(payload.redirectUrl ?? "");
  const qrCodeBody = String(payload.qrCodeBody ?? "");
  if (!paymentId || !redirectUrl || !qrCodeBody) {
    throw new MayaApiError("Maya returned an incomplete QR payment response.", 502);
  }
  return { paymentId, redirectUrl, qrCodeBody, raw: payload };
}

export async function retrieveMayaPayment(config: MayaConfig, paymentId: string) {
  const response = await mayaRequest(
    config,
    `/payments/v1/payments/${encodeURIComponent(paymentId)}`,
    "secret",
  );
  if (Array.isArray(response)) {
    const first = response[0];
    if (!first || typeof first !== "object") {
      throw new MayaApiError("Maya returned no payment details.", 502);
    }
    return first as Record<string, unknown>;
  }
  return response;
}

export async function testMayaConnection(config: MayaConfig) {
  await mayaRequest(config, "/payments/v1/webhooks", "secret");
}

export async function registerMayaWebhook(
  config: MayaConfig,
  name: "PAYMENT_SUCCESS" | "PAYMENT_FAILED",
  callbackUrl: string,
) {
  return mayaRequest(config, "/payments/v1/webhooks", "secret", {
    method: "POST",
    body: JSON.stringify({ name, callbackUrl }),
  });
}
