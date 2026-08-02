"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { auditEvents, merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";

export async function updateMerchantPublicProfile(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  if (access.membership.role !== "owner") redirect("/access-denied");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (displayName.length < 2 || displayName.length > 160 || description.length > 1200) {
    redirect("/merchant/public?error=Check+the+merchant+name+and+description.");
  }

  const db = getDb();
  await db.batch([
    db
      .update(merchants)
      .set({ displayName, description: description || null, updatedAt: new Date() })
      .where(eq(merchants.id, access.membership.merchantId)),
    db.insert(auditEvents).values({
      merchantId: access.membership.merchantId,
      actorUserId: access.user.id,
      action: "merchant.public_profile_updated",
      targetType: "merchant",
      targetId: access.membership.merchantId,
      after: { displayName, description: description || null },
    }),
  ]);

  revalidatePath("/merchant/public");
  revalidatePath(`/${access.membership.merchantSlug}`);
  redirect("/merchant/public?success=Merchant+page+details+saved.");
}
