"use server";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { courts, siteOperatingHours, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { toSlug } from "@/lib/slug";

type VenueMessage =
  | "court-created"
  | "court-updated"
  | "invalid-court"
  | "invalid-payment-settings"
  | "invalid-site"
  | "payment-settings-updated"
  | "site-created";

function venuesUrl(message: VenueMessage) {
  const parameter =
    message === "court-created" ||
    message === "court-updated" ||
    message === "payment-settings-updated" ||
    message === "site-created"
      ? "success"
      : "error";
  return `/merchant/venues?${parameter}=${message}`;
}

function parseHourlyRate(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? ""));

  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return null;
  }

  return Math.round(amount * 100);
}

export async function createSite(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");

  if (access.membership.role !== "owner") {
    redirect("/access-denied");
  }

  const merchantId = access.membership.merchantId;
  const name = String(formData.get("name") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const opensAt = String(formData.get("opensAt") ?? "");
  const closesAt = String(formData.get("closesAt") ?? "");

  if (
    name.length < 2 ||
    name.length > 160 ||
    addressLine1.length < 4 ||
    addressLine1.length > 200 ||
    city.length < 2 ||
    city.length > 100 ||
    province.length > 100 ||
    !/^\d{2}:\d{2}$/.test(opensAt) ||
    !/^\d{2}:\d{2}$/.test(closesAt) ||
    opensAt >= closesAt
  ) {
    redirect(venuesUrl("invalid-site"));
  }

  const db = getDb();
  const siteId = randomUUID();
  const baseSlug = toSlug(name, "site");
  const [slugTaken] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.merchantId, merchantId),
        sql`lower(${sites.slug}) = ${baseSlug}`,
      ),
    )
    .limit(1);
  const slug = slugTaken ? `${baseSlug}-${siteId.slice(0, 8)}` : baseSlug;

  await db.batch([
    db.insert(sites).values({
      id: siteId,
      merchantId,
      name,
      slug,
      status: "active",
      addressLine1,
      city,
      province: province || null,
      contactEmail: access.user.email,
    }),
    db.insert(siteOperatingHours).values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        merchantId,
        siteId,
        dayOfWeek,
        opensAt,
        closesAt,
      })),
    ),
  ]);

  revalidatePath("/merchant");
  revalidatePath("/merchant/venues");
  redirect(venuesUrl("site-created"));
}

export async function createCourt(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  const merchantId = access.membership.merchantId;
  const siteId = String(formData.get("siteId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const surfaceType = String(formData.get("surfaceType") ?? "").trim();
  const baseHourlyRateCents = parseHourlyRate(formData.get("hourlyRate"));
  const indoor = formData.get("indoor") === "on";

  if (
    !siteId ||
    name.length < 2 ||
    name.length > 120 ||
    surfaceType.length > 100 ||
    baseHourlyRateCents === null
  ) {
    redirect(venuesUrl("invalid-court"));
  }

  if (!access.sites.some((site) => site.id === siteId)) {
    redirect(venuesUrl("invalid-court"));
  }

  const db = getDb();
  const [ownedSite] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.merchantId, merchantId),
        eq(sites.status, "active"),
      ),
    )
    .limit(1);

  if (!ownedSite) {
    redirect(venuesUrl("invalid-court"));
  }

  const courtId = randomUUID();
  const baseSlug = toSlug(name, "court");
  const [slugTaken] = await db
    .select({ id: courts.id })
    .from(courts)
    .where(
      and(
        eq(courts.siteId, siteId),
        sql`lower(${courts.slug}) = ${baseSlug}`,
      ),
    )
    .limit(1);
  const slug = slugTaken ? `${baseSlug}-${courtId.slice(0, 8)}` : baseSlug;

  await db.insert(courts).values({
    id: courtId,
    merchantId,
    siteId,
    name,
    slug,
    baseHourlyRateCents,
    surfaceType: surfaceType || null,
    indoor,
    status: "active",
  });

  revalidatePath("/merchant");
  revalidatePath("/merchant/venues");
  redirect(venuesUrl("court-created"));
}

export async function updateCourt(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  const merchantId = access.membership.merchantId;
  const courtId = String(formData.get("courtId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const surfaceType = String(formData.get("surfaceType") ?? "").trim();
  const baseHourlyRateCents = parseHourlyRate(formData.get("hourlyRate"));
  const indoor = formData.get("indoor") === "on";
  const status = String(formData.get("status") ?? "");
  const allowedStatuses = new Set(["active", "inactive", "maintenance"]);

  if (
    !courtId ||
    name.length < 2 ||
    name.length > 120 ||
    surfaceType.length > 100 ||
    baseHourlyRateCents === null ||
    !allowedStatuses.has(status)
  ) {
    redirect(venuesUrl("invalid-court"));
  }

  const db = getDb();
  const [ownedCourt] = await db
    .select({ siteId: courts.siteId, siteSlug: sites.slug })
    .from(courts)
    .innerJoin(
      sites,
      and(
        eq(sites.id, courts.siteId),
        eq(sites.merchantId, courts.merchantId),
      ),
    )
    .where(and(eq(courts.id, courtId), eq(courts.merchantId, merchantId)))
    .limit(1);

  if (
    !ownedCourt ||
    !access.sites.some((site) => site.id === ownedCourt.siteId)
  ) {
    redirect(venuesUrl("invalid-court"));
  }

  await db
    .update(courts)
    .set({
      name,
      baseHourlyRateCents,
      surfaceType: surfaceType || null,
      indoor,
      status: status as "active" | "inactive" | "maintenance",
      updatedAt: new Date(),
    })
    .where(and(eq(courts.id, courtId), eq(courts.merchantId, merchantId)));

  revalidatePath("/merchant");
  revalidatePath("/merchant/venues");
  revalidatePath(
    `/${access.membership.merchantSlug}/${ownedCourt.siteSlug}`,
  );
  redirect(venuesUrl("court-updated"));
}

export async function updateSitePaymentSettings(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  const merchantId = access.membership.merchantId;
  const siteId = String(formData.get("siteId") ?? "");
  const manualPaymentEnabled = formData.get("manualPaymentEnabled") === "on";
  const manualReservationMode = String(formData.get("manualReservationMode") ?? "");
  const deadlineMinutes = Number(formData.get("manualPaymentDeadlineMinutes"));
  const instructions = String(formData.get("manualPaymentInstructions") ?? "").trim();
  const allowedModes = new Set([
    "reserve_immediately",
    "reserve_after_verification",
  ]);

  if (
    !siteId ||
    !access.sites.some((site) => site.id === siteId) ||
    !allowedModes.has(manualReservationMode) ||
    !Number.isInteger(deadlineMinutes) ||
    deadlineMinutes < 5 ||
    deadlineMinutes > 1440 ||
    instructions.length > 5000 ||
    (manualPaymentEnabled && instructions.length < 10)
  ) {
    redirect(venuesUrl("invalid-payment-settings"));
  }

  const db = getDb();
  const [updated] = await db
    .update(sites)
    .set({
      manualPaymentEnabled,
      manualReservationMode: manualReservationMode as
        | "reserve_immediately"
        | "reserve_after_verification",
      manualPaymentDeadlineMinutes: deadlineMinutes,
      manualPaymentInstructions: instructions || null,
      updatedAt: new Date(),
    })
    .where(and(eq(sites.id, siteId), eq(sites.merchantId, merchantId)))
    .returning({ slug: sites.slug });

  if (!updated) {
    redirect(venuesUrl("invalid-payment-settings"));
  }

  revalidatePath("/merchant/venues");
  revalidatePath(`/${access.membership.merchantSlug}/${updated.slug}`);
  redirect(venuesUrl("payment-settings-updated"));
}
