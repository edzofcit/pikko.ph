"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";

export async function updateMerchantBusinessSettings(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  if (access.membership.role !== "owner") redirect("/access-denied");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const businessAddress = String(formData.get("businessAddress") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const contactPhoneSecondary = String(formData.get("contactPhoneSecondary") ?? "").trim();
  if (
    displayName.length < 2 ||
    displayName.length > 160 ||
    description.length > 1200 ||
    businessAddress.length > 500 ||
    contactPhone.length > 40 ||
    contactPhoneSecondary.length > 40
  ) redirect("/merchant/settings?error=Check+the+business+profile+values.");

  const after = {
    displayName,
    description: description || null,
    businessAddress: businessAddress || null,
    contactPhone: contactPhone || null,
    contactPhoneSecondary: contactPhoneSecondary || null,
  };
  const db = getDb();
  await db.batch([
    db.update(merchants).set({ ...after, updatedAt: new Date() }).where(eq(merchants.id, access.membership.merchantId)),
    db.insert(auditEvents).values({
      merchantId: access.membership.merchantId,
      actorUserId: access.user.id,
      action: "merchant.business_settings_updated",
      targetType: "merchant",
      targetId: access.membership.merchantId,
      after,
    }),
  ]);

  revalidatePath("/merchant/settings");
  revalidatePath("/merchant/public");
  revalidatePath(`/${access.membership.merchantSlug}`);
  redirect("/merchant/settings?success=Business+settings+saved.");
}
