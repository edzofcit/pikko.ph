"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { merchantMemberships, merchants } from "@/db/schema";
import { syncCurrentUser } from "@/lib/auth/access";
import { toPublicMerchantSlug } from "@/lib/slug";

function onboardingUrl(error: "invalid" | "membership-exists") {
  return `/merchant/onboarding?error=${error}`;
}

export async function createMerchantAccount(formData: FormData) {
  const user = await syncCurrentUser();

  if (!user) {
    redirect(
      `/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/onboarding")}`,
    );
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();

  if (
    displayName.length < 2 ||
    displayName.length > 160 ||
    legalName.length > 200 ||
    contactPhone.length > 40
  ) {
    redirect(onboardingUrl("invalid"));
  }

  const db = getDb();
  const [existingMembership] = await db
    .select({ id: merchantMemberships.id })
    .from(merchantMemberships)
    .where(eq(merchantMemberships.userId, user.id))
    .limit(1);

  if (existingMembership) {
    redirect(onboardingUrl("membership-exists"));
  }

  const merchantId = randomUUID();
  const membershipId = randomUUID();
  const baseSlug = toPublicMerchantSlug(displayName);
  const [slugTaken] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(sql`lower(${merchants.slug}) = ${baseSlug}`)
    .limit(1);
  const slug = slugTaken
    ? `${baseSlug}-${merchantId.slice(0, 8)}`
    : baseSlug;
  const now = new Date();

  await db.batch([
    db.insert(merchants).values({
      id: merchantId,
      displayName,
      legalName: legalName || null,
      slug,
      status: "active",
      contactEmail: user.email,
      contactPhone: contactPhone || null,
      subscriptionStatus: "trialing",
    }),
    db.insert(merchantMemberships).values({
      id: membershipId,
      merchantId,
      userId: user.id,
      role: "owner",
      status: "active",
      invitedByUserId: user.id,
      acceptedAt: now,
    }),
  ]);

  revalidatePath("/merchant");
  redirect("/merchant/venues?success=merchant-created");
}
