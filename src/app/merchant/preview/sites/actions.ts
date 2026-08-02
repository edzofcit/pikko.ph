"use server";

import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  auditEvents,
  courtPhotos,
  courts,
  priceRules,
  siteOperatingHours,
  sitePhotos,
  sites,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { toSlug } from "@/lib/slug";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function previewUrl(siteId: string, tab: string, message: string, error = false) {
  const params = new URLSearchParams({ site: siteId, tab, [error ? "error" : "success"]: message });
  return `/merchant/sites?${params}`;
}

async function requireOwnedSite(permission: "manage_courts" | "manage_pricing", siteId: string) {
  const access = await requireMerchantPermission(permission);
  if (!UUID.test(siteId)) redirect("/access-denied");
  const [site] = await getDb().select({ id: sites.id, slug: sites.slug }).from(sites).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId))).limit(1);
  if (!site) redirect("/access-denied");
  if (access.membership.role !== "owner" && !access.sites.some((candidate) => candidate.id === siteId)) redirect("/access-denied");
  return { access, site };
}

function parseMoney(value: FormDataEntryValue | null) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? Math.round(amount * 100) : null;
}

function parseCoordinates(formData: FormData) {
  const latitudeValue = String(formData.get("latitude") ?? "").trim();
  const longitudeValue = String(formData.get("longitude") ?? "").trim();
  if (!latitudeValue && !longitudeValue) return { valid: true, latitude: null, longitude: null };
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !latitudeValue ||
    !longitudeValue ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { valid: false, latitude: null, longitude: null };
  }
  return { valid: true, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}

function parseAmenities(value: FormDataEntryValue | null) {
  return Array.from(new Set(String(value ?? "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean))).slice(0, 50);
}

export async function createSite(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  if (access.membership.role !== "owner") redirect("/access-denied");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const addressLine2 = String(formData.get("addressLine2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Manila").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const opensAt = String(formData.get("opensAt") ?? "06:00");
  const closesAt = String(formData.get("closesAt") ?? "23:00");
  const amenities = parseAmenities(formData.get("amenities"));
  const coordinates = parseCoordinates(formData);
  const valid = name.length >= 2 && name.length <= 160 && description.length <= 5000 && addressLine1.length >= 4 && addressLine1.length <= 200 && addressLine2.length <= 200 && city.length >= 2 && city.length <= 100 && province.length <= 100 && postalCode.length <= 20 && timezone.length >= 3 && timezone.length <= 64 && (!contactEmail || contactEmail.includes("@")) && contactPhone.length <= 40 && new Set(["draft", "active", "inactive"]).has(status) && coordinates.valid && TIME.test(opensAt) && TIME.test(closesAt) && opensAt < closesAt && amenities.every((item) => item.length <= 80);
  if (!valid) redirect("/merchant/sites?mode=new&error=Check+the+site+details+and+location.");
  const db = getDb();
  const siteId = randomUUID();
  const baseSlug = toSlug(name, "site");
  const [slugTaken] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.merchantId, access.membership.merchantId), sql`lower(${sites.slug}) = ${baseSlug}`)).limit(1);
  const slug = slugTaken ? `${baseSlug}-${siteId.slice(0, 8)}` : baseSlug;
  await db.batch([
    db.insert(sites).values({ id: siteId, merchantId: access.membership.merchantId, name, slug, status: status as "draft" | "active" | "inactive", description: description || null, addressLine1, addressLine2: addressLine2 || null, city, province: province || null, postalCode: postalCode || null, latitude: coordinates.latitude, longitude: coordinates.longitude, timezone, contactEmail: contactEmail || access.user.email, contactPhone: contactPhone || null, amenities }),
    db.insert(siteOperatingHours).values(Array.from({ length: 7 }, (_, dayOfWeek) => ({ merchantId: access.membership!.merchantId, siteId, dayOfWeek, opensAt, closesAt }))),
    db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "site.created", targetType: "site", targetId: siteId, after: { name, slug, status, city, timezone, latitude: coordinates.latitude, longitude: coordinates.longitude } }),
  ]);
  revalidatePath("/merchant");
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "settings", "Site created. Continue configuring payments and photos."));
}

export async function createCourt(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  const name = String(formData.get("name") ?? "").trim();
  const surfaceType = String(formData.get("surfaceType") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rateCents = parseMoney(formData.get("hourlyRate"));
  const indoor = formData.get("indoor") === "on";
  if (name.length < 2 || name.length > 120 || surfaceType.length > 100 || description.length > 5000 || rateCents === null) redirect(previewUrl(siteId, "courts", "Check the court details.", true));
  const db = getDb();
  const courtId = randomUUID();
  const baseSlug = toSlug(name, "court");
  const [slugTaken] = await db.select({ id: courts.id }).from(courts).where(and(eq(courts.siteId, siteId), sql`lower(${courts.slug}) = ${baseSlug}`)).limit(1);
  const slug = slugTaken ? `${baseSlug}-${courtId.slice(0, 8)}` : baseSlug;
  await db.insert(courts).values({ id: courtId, merchantId: access.membership.merchantId, siteId, name, slug, description: description || null, baseHourlyRateCents: rateCents, surfaceType: surfaceType || null, indoor, status: "active" });
  await db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "court.created", targetType: "court", targetId: courtId, after: { siteId, name, rateCents, indoor, surfaceType } });
  revalidatePath("/merchant");
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "courts", "Court created."));
}

export async function updateCourt(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const courtId = String(formData.get("courtId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  const name = String(formData.get("name") ?? "").trim();
  const surfaceType = String(formData.get("surfaceType") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const rateCents = parseMoney(formData.get("hourlyRate"));
  const indoor = formData.get("indoor") === "on";
  if (!UUID.test(courtId) || name.length < 2 || name.length > 120 || surfaceType.length > 100 || description.length > 5000 || rateCents === null || !new Set(["active", "inactive", "maintenance"]).has(status)) redirect(previewUrl(siteId, "courts", "Check the court details.", true));
  const [updated] = await getDb().update(courts).set({ name, description: description || null, surfaceType: surfaceType || null, baseHourlyRateCents: rateCents, indoor, status: status as "active" | "inactive" | "maintenance", updatedAt: new Date() }).where(and(eq(courts.id, courtId), eq(courts.siteId, siteId), eq(courts.merchantId, access.membership.merchantId))).returning({ id: courts.id });
  if (!updated) redirect(previewUrl(siteId, "courts", "Court not found.", true));
  await getDb().insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "court.updated", targetType: "court", targetId: courtId, after: { name, status, rateCents, indoor, surfaceType } });
  revalidatePath("/merchant");
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "courts", "Court updated."));
}

export async function createRateRule(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access } = await requireOwnedSite("manage_pricing", siteId);
  const courtId = String(formData.get("courtId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "recurring");
  const dayValue = String(formData.get("dayOfWeek") ?? "");
  const dayOfWeek = dayValue === "" ? null : Number(dayValue);
  const specialDate = String(formData.get("specialDate") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const rateCents = parseMoney(formData.get("hourlyRate"));
  const allowedTypes = new Set(["recurring", "special_date", "seasonal"]);
  const db = getDb();
  const [ownedCourt] = courtId ? await db.select({ id: courts.id }).from(courts).where(and(eq(courts.id, courtId), eq(courts.siteId, siteId), eq(courts.merchantId, access.membership.merchantId))).limit(1) : [null];
  const valid = name.length >= 2 && name.length <= 160 && allowedTypes.has(type) && TIME.test(startsAt) && TIME.test(endsAt) && startsAt < endsAt && rateCents !== null && (!courtId || ownedCourt) && (type !== "recurring" || (Number.isInteger(dayOfWeek) && dayOfWeek! >= 0 && dayOfWeek! <= 6)) && (type !== "special_date" || DATE.test(specialDate));
  if (!valid) redirect(previewUrl(siteId, "rates", "Check the rate rule details.", true));
  const [created] = await db.insert(priceRules).values({ merchantId: access.membership.merchantId, siteId, courtId: courtId || null, name, type: type as "recurring" | "special_date" | "seasonal", dayOfWeek: type === "recurring" ? dayOfWeek : null, specialDate: type === "special_date" ? specialDate : null, startsAt, endsAt, activeFrom: type === "seasonal" && DATE.test(String(formData.get("activeFrom") ?? "")) ? String(formData.get("activeFrom")) : null, activeUntil: type === "seasonal" && DATE.test(String(formData.get("activeUntil") ?? "")) ? String(formData.get("activeUntil")) : null, hourlyRateCents: rateCents }).returning({ id: priceRules.id });
  await db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "rate_rule.created", targetType: "price_rule", targetId: created.id, after: { siteId, courtId: courtId || null, name, type, rateCents } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "rates", "Rate rule created."));
}

export async function deactivateRateRule(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { access } = await requireOwnedSite("manage_pricing", siteId);
  if (!UUID.test(ruleId)) redirect(previewUrl(siteId, "rates", "Invalid rate rule.", true));
  const [updated] = await getDb().update(priceRules).set({ active: false, updatedAt: new Date() }).where(and(eq(priceRules.id, ruleId), eq(priceRules.siteId, siteId), eq(priceRules.merchantId, access.membership.merchantId))).returning({ id: priceRules.id });
  if (!updated) redirect(previewUrl(siteId, "rates", "Rate rule was not found.", true));
  await getDb().insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "rate_rule.deactivated", targetType: "price_rule", targetId: ruleId, before: { active: true }, after: { active: false } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "rates", "Rate rule deactivated."));
}

export async function updateOperatingHours(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  const periods = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, enabled: formData.get(`enabled-${dayOfWeek}`) === "on", opensAt: String(formData.get(`opens-${dayOfWeek}`) ?? ""), closesAt: String(formData.get(`closes-${dayOfWeek}`) ?? "") }));
  if (periods.some((period) => period.enabled && (!TIME.test(period.opensAt) || !TIME.test(period.closesAt) || period.opensAt >= period.closesAt))) redirect(previewUrl(siteId, "operating hours", "Check the opening and closing times.", true));
  const db = getDb();
  await db.delete(siteOperatingHours).where(and(eq(siteOperatingHours.siteId, siteId), eq(siteOperatingHours.merchantId, access.membership.merchantId)));
  const enabled = periods.filter((period) => period.enabled);
  if (enabled.length) await db.insert(siteOperatingHours).values(enabled.map((period) => ({ merchantId: access.membership.merchantId, siteId, dayOfWeek: period.dayOfWeek, opensAt: period.opensAt, closesAt: period.closesAt })));
  await db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "site.operating_hours_updated", targetType: "site", targetId: siteId, after: { periods: enabled } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "operating hours", "Operating hours updated."));
}

export async function updateAmenities(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  const amenities = parseAmenities(formData.get("amenities"));
  if (amenities.some((item) => item.length > 80)) redirect(previewUrl(siteId, "amenities", "Amenities must be 80 characters or fewer.", true));
  await getDb().update(sites).set({ amenities, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId)));
  await getDb().insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "site.amenities_updated", targetType: "site", targetId: siteId, after: { amenities } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "amenities", "Amenities updated."));
}

export async function updateSiteSettings(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access, site } = await requireOwnedSite("manage_courts", siteId);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const addressLine2 = String(formData.get("addressLine2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Manila").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const coordinates = parseCoordinates(formData);
  const valid = name.length >= 2 && name.length <= 160 && description.length <= 5000 && addressLine1.length >= 4 && addressLine1.length <= 200 && addressLine2.length <= 200 && city.length >= 2 && city.length <= 100 && province.length <= 100 && postalCode.length <= 20 && timezone.length >= 3 && timezone.length <= 64 && contactPhone.length <= 40 && coordinates.valid && new Set(["draft", "active", "inactive"]).has(status) && (!contactEmail || contactEmail.includes("@"));
  if (!valid) redirect(previewUrl(siteId, "settings", "Check the site settings and map coordinates.", true));
  await getDb().update(sites).set({ name, description: description || null, addressLine1, addressLine2: addressLine2 || null, city, province: province || null, postalCode: postalCode || null, timezone, latitude: coordinates.latitude, longitude: coordinates.longitude, contactEmail: contactEmail || null, contactPhone: contactPhone || null, status: status as "draft" | "active" | "inactive", updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId)));
  await getDb().insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "site.updated", targetType: "site", targetId: siteId, after: { name, description, addressLine1, addressLine2, city, province, postalCode, timezone, latitude: coordinates.latitude, longitude: coordinates.longitude, contactEmail, contactPhone, status } });
  revalidatePath("/merchant/sites");
  revalidatePath(`/${access.membership.merchantSlug}/${site.slug}`);
  redirect(previewUrl(siteId, "settings", "Site settings updated."));
}

export async function updateSiteBookingSettings(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  const bookingLeadMinutes = Number(formData.get("bookingLeadMinutes"));
  const advanceBookingDays = Number(formData.get("advanceBookingDays"));
  const manualPaymentDeadlineMinutes = Number(formData.get("manualPaymentDeadlineMinutes"));
  const manualReservationMode = String(formData.get("manualReservationMode") ?? "reserve_immediately");
  const manualPaymentInstructions = String(formData.get("manualPaymentInstructions") ?? "").trim();
  const onlinePaymentEnabled = formData.get("onlinePaymentEnabled") === "on";
  const manualPaymentEnabled = formData.get("manualPaymentEnabled") === "on";
  const valid = Number.isInteger(bookingLeadMinutes) && bookingLeadMinutes >= 0 && bookingLeadMinutes <= 10080 && Number.isInteger(advanceBookingDays) && advanceBookingDays >= 1 && advanceBookingDays <= 730 && Number.isInteger(manualPaymentDeadlineMinutes) && manualPaymentDeadlineMinutes >= 5 && manualPaymentDeadlineMinutes <= 1440 && new Set(["reserve_immediately", "reserve_after_verification"]).has(manualReservationMode) && manualPaymentInstructions.length <= 5000 && (!manualPaymentEnabled || manualPaymentInstructions.length >= 4);
  if (!valid) redirect(previewUrl(siteId, "settings", "Check the booking and payment settings.", true));
  await getDb().update(sites).set({ bookingLeadMinutes, advanceBookingDays, onlinePaymentEnabled, manualPaymentEnabled, manualReservationMode: manualReservationMode as "reserve_immediately" | "reserve_after_verification", manualPaymentDeadlineMinutes, manualPaymentInstructions: manualPaymentInstructions || null, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.merchantId, access.membership.merchantId)));
  await getDb().insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "site.booking_settings_updated", targetType: "site", targetId: siteId, after: { bookingLeadMinutes, advanceBookingDays, onlinePaymentEnabled, manualPaymentEnabled, manualReservationMode, manualPaymentDeadlineMinutes } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "settings", "Booking and payment settings updated."));
}

export async function setVenueCoverPhoto(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const courtId = String(formData.get("courtId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  if (!UUID.test(photoId)) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
  const db = getDb();
  if (courtId) {
    const [photo] = await db.select({ id: courtPhotos.id }).from(courtPhotos).innerJoin(courts, eq(courts.id, courtPhotos.courtId)).where(and(eq(courtPhotos.id, photoId), eq(courtPhotos.courtId, courtId), eq(courts.siteId, siteId), eq(courtPhotos.merchantId, access.membership.merchantId))).limit(1);
    if (!photo) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
    await db.update(courtPhotos).set({ isCover: false, updatedAt: new Date() }).where(eq(courtPhotos.courtId, courtId));
    await db.update(courtPhotos).set({ isCover: true, updatedAt: new Date() }).where(eq(courtPhotos.id, photoId));
  } else {
    const [photo] = await db.select({ id: sitePhotos.id }).from(sitePhotos).where(and(eq(sitePhotos.id, photoId), eq(sitePhotos.siteId, siteId), eq(sitePhotos.merchantId, access.membership.merchantId))).limit(1);
    if (!photo) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
    await db.update(sitePhotos).set({ isCover: false, updatedAt: new Date() }).where(eq(sitePhotos.siteId, siteId));
    await db.update(sitePhotos).set({ isCover: true, updatedAt: new Date() }).where(eq(sitePhotos.id, photoId));
  }
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "photos", "Cover photo updated."));
}

export async function deleteVenuePhoto(formData: FormData) {
  const siteId = String(formData.get("siteId") ?? "");
  const courtId = String(formData.get("courtId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const { access } = await requireOwnedSite("manage_courts", siteId);
  if (!UUID.test(photoId)) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
  const db = getDb();
  let pathname = "";
  let wasCover = false;
  if (courtId) {
    const [photo] = await db.select({ pathname: courtPhotos.pathname, isCover: courtPhotos.isCover }).from(courtPhotos).innerJoin(courts, eq(courts.id, courtPhotos.courtId)).where(and(eq(courtPhotos.id, photoId), eq(courtPhotos.courtId, courtId), eq(courts.siteId, siteId), eq(courtPhotos.merchantId, access.membership.merchantId))).limit(1);
    if (!photo) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
    ({ pathname, isCover: wasCover } = photo);
    await db.delete(courtPhotos).where(eq(courtPhotos.id, photoId));
    if (wasCover) {
      const [next] = await db.select({ id: courtPhotos.id }).from(courtPhotos).where(eq(courtPhotos.courtId, courtId)).orderBy(asc(courtPhotos.sortOrder)).limit(1);
      if (next) await db.update(courtPhotos).set({ isCover: true }).where(eq(courtPhotos.id, next.id));
    }
  } else {
    const [photo] = await db.select({ pathname: sitePhotos.pathname, isCover: sitePhotos.isCover }).from(sitePhotos).where(and(eq(sitePhotos.id, photoId), eq(sitePhotos.siteId, siteId), eq(sitePhotos.merchantId, access.membership.merchantId))).limit(1);
    if (!photo) redirect(previewUrl(siteId, "photos", "Photo not found.", true));
    ({ pathname, isCover: wasCover } = photo);
    await db.delete(sitePhotos).where(eq(sitePhotos.id, photoId));
    if (wasCover) {
      const [next] = await db.select({ id: sitePhotos.id }).from(sitePhotos).where(eq(sitePhotos.siteId, siteId)).orderBy(asc(sitePhotos.sortOrder)).limit(1);
      if (next) await db.update(sitePhotos).set({ isCover: true }).where(eq(sitePhotos.id, next.id));
    }
  }
  await del(pathname).catch((error) => console.error("Venue photo blob cleanup failed", error));
  await db.insert(auditEvents).values({ merchantId: access.membership.merchantId, actorUserId: access.user.id, action: "venue_photo.deleted", targetType: courtId ? "court" : "site", targetId: courtId || siteId, before: { pathname } });
  revalidatePath("/merchant/sites");
  redirect(previewUrl(siteId, "photos", "Photo deleted."));
}
