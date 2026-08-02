"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, merchants } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MERCHANT_STATUSES = new Set([
  "onboarding",
  "active",
  "suspended",
  "archived",
]);
const SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

function adminUrl(kind: "success" | "error", message: string) {
  return `/admin?${kind}=${encodeURIComponent(message)}`;
}

function pesoToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? ""));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return null;
  }
  return Math.round(amount * 100);
}

function percentToBasisPoints(value: FormDataEntryValue | null) {
  const percentage = Number(String(value ?? ""));
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return null;
  }
  return Math.round(percentage * 100);
}

export async function updateMerchantCommercialSettings(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const merchantId = String(formData.get("merchantId") ?? "");
  const status = String(formData.get("status") ?? "");
  const subscriptionStatus = String(formData.get("subscriptionStatus") ?? "");
  const monthlyCourtPriceCents = pesoToCents(
    formData.get("monthlyCourtPrice"),
  );
  const gatewayFeeBasisPoints = percentToBasisPoints(
    formData.get("gatewayFeePercentage"),
  );

  if (
    !UUID_PATTERN.test(merchantId) ||
    !MERCHANT_STATUSES.has(status) ||
    !SUBSCRIPTION_STATUSES.has(subscriptionStatus) ||
    monthlyCourtPriceCents === null ||
    gatewayFeeBasisPoints === null
  ) {
    redirect(adminUrl("error", "Check the merchant status, subscription, and fee values."));
  }

  const db = getDb();
  const [merchant] = await db
    .select({
      id: merchants.id,
      displayName: merchants.displayName,
      status: merchants.status,
      subscriptionStatus: merchants.subscriptionStatus,
      monthlyCourtPriceCents: merchants.monthlyCourtPriceCents,
      gatewayFeeBasisPoints: merchants.gatewayFeeBasisPoints,
    })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    redirect(adminUrl("error", "Merchant account not found."));
  }

  const nextSettings = {
    status: status as (typeof merchants.$inferInsert)["status"],
    subscriptionStatus:
      subscriptionStatus as (typeof merchants.$inferInsert)["subscriptionStatus"],
    monthlyCourtPriceCents,
    gatewayFeeBasisPoints,
  };
  const now = new Date();

  await db.batch([
    db
      .update(merchants)
      .set({ ...nextSettings, updatedAt: now })
      .where(eq(merchants.id, merchantId)),
    db.insert(auditEvents).values({
      merchantId,
      actorUserId: admin.id,
      action: "platform.merchant.settings_updated",
      targetType: "merchant",
      targetId: merchantId,
      before: {
        status: merchant.status,
        subscriptionStatus: merchant.subscriptionStatus,
        monthlyCourtPriceCents: merchant.monthlyCourtPriceCents,
        gatewayFeeBasisPoints: merchant.gatewayFeeBasisPoints,
      },
      after: nextSettings,
      metadata: { merchantName: merchant.displayName },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/");
  redirect(adminUrl("success", `${merchant.displayName} settings updated.`));
}
