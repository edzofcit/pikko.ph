"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { getDb } from "@/db";
import {
  auditEvents,
  courts,
  merchantMemberships,
  merchants,
  platformSettings,
  sites,
  subscriptionInvoices,
  users,
} from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { processSubscriptionBilling } from "@/lib/billing/subscriptions";
import { pikkoEmailSender } from "@/lib/email/sender";
import { normalizeManualPaymentOptions } from "@/lib/manual-payment/options";
import { getMayaConfig, registerMayaWebhook, testMayaConnection } from "@/lib/payments/maya";
import { encryptPlatformSecret } from "@/lib/security/encrypted-secret";
import { toPublicMerchantSlug } from "@/lib/slug";

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

function merchantAdminUrl(kind: "success" | "error", message: string) {
  return `/admin/merchants?${kind}=${encodeURIComponent(message)}`;
}

function settingsAdminUrl(kind: "success" | "error", message: string) {
  return `/admin/settings?${kind}=${encodeURIComponent(message)}`;
}

function merchantDetailUrl(merchantId: string, kind: "success" | "error", message: string) {
  return `/admin/merchants/${merchantId}?${kind}=${encodeURIComponent(message)}`;
}

function optionalText(value: FormDataEntryValue | null, maximum: number) {
  const text = String(value ?? "").trim();
  return text.length <= maximum ? text || null : undefined;
}

function commaList(value: FormDataEntryValue | null) {
  return Array.from(new Set(String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean))).slice(0, 40);
}

function coordinate(value: FormDataEntryValue | null, minimum: number, maximum: number) {
  const text = String(value ?? "").trim(); if (!text) return null; const number = Number(text);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number.toFixed(6) : undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appUrl() {
  return (process.env.APP_URL?.trim() || "https://pikko.ph").replace(/\/$/, "");
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
  const onlinePaymentsAllowed = formData.get("onlinePaymentsAllowed") === "on";

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
      onlinePaymentsAllowed: merchants.onlinePaymentsAllowed,
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
    onlinePaymentsAllowed,
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
        onlinePaymentsAllowed: merchant.onlinePaymentsAllowed,
      },
      after: nextSettings,
      metadata: { merchantName: merchant.displayName },
    }),
    db
      .update(sites)
      .set({
        onlinePaymentEnabled: onlinePaymentsAllowed
          ? sql`${sites.onlinePaymentEnabled}`
          : false,
        updatedAt: now,
      })
      .where(eq(sites.merchantId, merchantId)),
  ]);

  if (nextSettings.subscriptionStatus === "active") {
    await processSubscriptionBilling({ merchantId, actorUserId: admin.id, now });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/merchants");
  revalidatePath("/admin/invoices");
  revalidatePath("/");
  const returnTo = String(formData.get("returnTo") ?? "");
  redirect(
    returnTo === "/admin/merchants"
      ? merchantAdminUrl("success", `${merchant.displayName} settings updated.`)
      : adminUrl("success", `${merchant.displayName} settings updated.`),
  );
}

export async function manuallyOnboardMerchant(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    displayName.length < 2 ||
    displayName.length > 160 ||
    legalName.length > 200 ||
    ownerName.length < 2 ||
    ownerName.length > 160 ||
    !emailPattern.test(ownerEmail) ||
    ownerEmail.length > 320 ||
    contactPhone.length > 40
  ) {
    redirect(merchantAdminUrl("error", "Check the merchant and owner details."));
  }

  const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!authBaseUrl || !resendApiKey) {
    redirect(merchantAdminUrl("error", "Authentication and email must be configured before onboarding."));
  }

  const db = getDb();
  await db.insert(platformSettings).values({ key: "default" }).onConflictDoNothing();
  const [defaults] = await db.select().from(platformSettings).where(eq(platformSettings.key, "default")).limit(1);
  const defaultMonthlyCourtPriceCents = defaults?.defaultMonthlyCourtPriceCents ?? 59900;
  const defaultGatewayFeeBasisPoints = defaults?.defaultGatewayFeeBasisPoints ?? 0;
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${ownerEmail}`)
    .limit(1);
  if (existingUser) {
    redirect(merchantAdminUrl("error", "That owner email already has a Pikko.ph account."));
  }

  const merchantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const baseSlug = toPublicMerchantSlug(displayName);
  const [slugTaken] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(sql`lower(${merchants.slug}) = ${baseSlug}`)
    .limit(1);
  const slug = slugTaken ? `${baseSlug}-${merchantId.slice(0, 8)}` : baseSlug;
  const temporaryPassword = `${randomBytes(18).toString("base64url")}aA1!`;
  const origin = appUrl();
  let authSubject: string | null = null;
  let provisioningError: string | null = null;

  try {
    const response = await fetch(`${authBaseUrl.replace(/\/$/, "")}/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email: ownerEmail, password: temporaryPassword, name: ownerName }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { user?: { id?: string }; message?: string }
      | null;
    if (!response.ok || !payload?.user?.id) {
      console.error("Admin merchant auth provisioning failed", {
        status: response.status,
        message: payload?.message,
      });
      provisioningError =
        "The temporary login could not be created. The email may already be registered.";
    } else {
      authSubject = payload.user.id;
    }
  } catch (error) {
    console.error("Admin merchant auth provisioning failed", error);
    provisioningError =
      "The authentication service could not create the merchant login.";
  }

  if (!authSubject) {
    redirect(merchantAdminUrl("error", provisioningError ?? "The merchant login could not be created."));
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);
  await db.batch([
    db.insert(users).values({
      id: userId,
      authSubject,
      email: ownerEmail,
      fullName: ownerName,
      status: "active",
    }),
    db.insert(merchants).values({
      id: merchantId,
      displayName,
      legalName: legalName || null,
      slug,
      status: "active",
      contactEmail: ownerEmail,
      contactPhone: contactPhone || null,
      subscriptionStatus: "trialing",
      trialEndsAt,
      monthlyCourtPriceCents: defaultMonthlyCourtPriceCents,
      gatewayFeeBasisPoints: defaultGatewayFeeBasisPoints,
    }),
    db.insert(merchantMemberships).values({
      id: membershipId,
      merchantId,
      userId,
      role: "owner",
      status: "active",
      invitedByUserId: admin.id,
      acceptedAt: now,
    }),
    db.insert(auditEvents).values({
      merchantId,
      actorUserId: admin.id,
      action: "platform.merchant.manually_onboarded",
      targetType: "merchant",
      targetId: merchantId,
      after: {
        displayName,
        slug,
        ownerEmail,
        subscriptionStatus: "trialing",
        trialEndsAt,
        monthlyCourtPriceCents: defaultMonthlyCourtPriceCents,
        gatewayFeeBasisPoints: defaultGatewayFeeBasisPoints,
      },
    }),
  ]);

  let emailSent = false;
  try {
    const resend = new Resend(resendApiKey);
    const signInUrl = `${origin}/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant`;
    const securityUrl = `${origin}/account/security`;
    const { error } = await resend.emails.send(
      {
        from: pikkoEmailSender(),
        to: ownerEmail,
        subject: `Your ${displayName} merchant access on Pikko.ph`,
        text: [
          `Hi ${ownerName},`,
          "",
          `${displayName} has been created on Pikko.ph with a 14-day trial.`,
          `Login: ${ownerEmail}`,
          `Temporary password: ${temporaryPassword}`,
          `Sign in: ${signInUrl}`,
          `Change password: ${securityUrl}`,
          "",
          "For security, change this temporary password after your first sign-in and do not share it.",
          `After the trial, billing starts at PHP ${(defaultMonthlyCourtPriceCents / 100).toLocaleString("en-PH")} per active court per month unless your platform rate is changed.`,
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#173d32"><h1>Welcome to Pikko.ph</h1><p>Hi ${escapeHtml(ownerName)},</p><p><strong>${escapeHtml(displayName)}</strong> is ready with a 14-day trial.</p><div style="padding:18px;border-radius:14px;background:#f7f5eb"><p><strong>Login:</strong> ${escapeHtml(ownerEmail)}</p><p><strong>Temporary password:</strong> <code>${escapeHtml(temporaryPassword)}</code></p></div><p><a href="${escapeHtml(signInUrl)}">Sign in to your merchant dashboard</a></p><p>For security, <a href="${escapeHtml(securityUrl)}">change the temporary password</a> after your first sign-in. Billing begins after the trial at PHP ${(defaultMonthlyCourtPriceCents / 100).toLocaleString("en-PH")} per active court per month unless your platform rate is changed.</p></div>`,
      },
      { idempotencyKey: `merchant-onboarding-${merchantId}` },
    );
    emailSent = !error;
    if (error) console.error("Merchant onboarding email rejected", { name: error.name, message: error.message });
  } catch (error) {
    console.error("Merchant onboarding email failed", error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/merchants");
  redirect(
    merchantAdminUrl(
      emailSent ? "success" : "error",
      emailSent
        ? `${displayName} was created and temporary access was emailed to ${ownerEmail}.`
        : `${displayName} was created, but the temporary-access email failed. Contact support before retrying.`,
    ),
  );
}

export async function updatePlatformSettings(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const defaultMonthlyCourtPriceCents = pesoToCents(formData.get("defaultMonthlyCourtPrice"));
  const defaultGatewayFeeBasisPoints = percentToBasisPoints(formData.get("defaultGatewayFeePercentage"));
  const mayaEnvironment = String(formData.get("mayaEnvironment") ?? "sandbox");
  const mayaPublicKey = String(formData.get("mayaPublicKey") ?? "").trim();
  const mayaSecretKey = String(formData.get("mayaSecretKey") ?? "").trim();
  if (
    defaultMonthlyCourtPriceCents === null ||
    defaultGatewayFeeBasisPoints === null ||
    !new Set(["sandbox", "production"]).has(mayaEnvironment) ||
    (mayaPublicKey && (!mayaPublicKey.startsWith("pk-") || mayaPublicKey.length > 500)) ||
    (mayaSecretKey && (!mayaSecretKey.startsWith("sk-") || mayaSecretKey.length > 500))
  ) {
    redirect(settingsAdminUrl("error", "Check the default subscription and gateway fee values."));
  }
  const db = getDb();
  await db.insert(platformSettings).values({ key: "default" }).onConflictDoNothing();
  const [before] = await db.select().from(platformSettings).where(eq(platformSettings.key, "default")).limit(1);
  if (!before) redirect(settingsAdminUrl("error", "Platform settings could not be loaded."));
  const mayaPublicKeyEncrypted = mayaPublicKey
    ? encryptPlatformSecret(mayaPublicKey)
    : before.mayaPublicKeyEncrypted;
  const mayaSecretKeyEncrypted = mayaSecretKey
    ? encryptPlatformSecret(mayaSecretKey)
    : before.mayaSecretKeyEncrypted;
  const mayaEnabled =
    formData.get("mayaEnabled") === "on" &&
    Boolean(mayaPublicKeyEncrypted && mayaSecretKeyEncrypted);
  const after = {
    defaultMonthlyCourtPriceCents,
    defaultGatewayFeeBasisPoints,
    mayaEnabled,
    mayaEnvironment,
    mayaPublicKeyEncrypted,
    mayaSecretKeyEncrypted,
    mayaPublicKeyLastFour: mayaPublicKey ? mayaPublicKey.slice(-4) : before.mayaPublicKeyLastFour,
    mayaSecretKeyLastFour: mayaSecretKey ? mayaSecretKey.slice(-4) : before.mayaSecretKeyLastFour,
  };
  await db.batch([
    db.update(platformSettings).set({ ...after, updatedAt: new Date() }).where(eq(platformSettings.key, "default")),
    db.insert(auditEvents).values({
      actorUserId: admin.id,
      action: "platform.settings.updated",
      targetType: "platform_settings",
      before: { defaultMonthlyCourtPriceCents: before.defaultMonthlyCourtPriceCents, defaultGatewayFeeBasisPoints: before.defaultGatewayFeeBasisPoints, mayaEnabled: before.mayaEnabled, mayaEnvironment: before.mayaEnvironment, mayaPublicKeyLastFour: before.mayaPublicKeyLastFour, mayaSecretKeyLastFour: before.mayaSecretKeyLastFour },
      after: { defaultMonthlyCourtPriceCents, defaultGatewayFeeBasisPoints, mayaEnabled, mayaEnvironment, mayaPublicKeyLastFour: after.mayaPublicKeyLastFour, mayaSecretKeyLastFour: after.mayaSecretKeyLastFour },
    }),
  ]);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/merchants");
  redirect(settingsAdminUrl("success", mayaEnabled ? "Platform defaults and Maya gateway updated." : "Platform defaults updated. Maya remains disabled."));
}

export async function verifyMayaGateway() {
  await requirePlatformAdmin();
  const config = await getMayaConfig({ requireEnabled: false });
  if (!config) redirect(settingsAdminUrl("error", "Save both Maya API keys before testing the connection."));
  try {
    await testMayaConnection(config);
  } catch (error) {
    console.error("Maya gateway verification failed", error);
    redirect(settingsAdminUrl("error", "Maya rejected the configured credentials. Check the environment and API keys."));
  }
  redirect(settingsAdminUrl("success", `Maya ${config.environment} credentials are valid.`));
}

export async function configureMayaWebhooks() {
  await requirePlatformAdmin();
  const config = await getMayaConfig({ requireEnabled: false });
  if (!config) redirect(settingsAdminUrl("error", "Save both Maya API keys before registering webhooks."));
  const callbackUrl = `${appUrl()}/api/payments/maya/webhook`;
  try {
    await Promise.all([
      registerMayaWebhook(config, "PAYMENT_SUCCESS", callbackUrl),
      registerMayaWebhook(config, "PAYMENT_FAILED", callbackUrl),
    ]);
  } catch (error) {
    console.error("Maya webhook registration failed", error);
    redirect(settingsAdminUrl("error", "Maya could not register the webhooks. They may already exist; verify them in Maya Manager."));
  }
  redirect(settingsAdminUrl("success", `Maya payment webhooks now point to ${callbackUrl}.`));
}

export async function updateMerchantProfile(formData: FormData) {
  const admin = await requirePlatformAdmin(); const merchantId = String(formData.get("merchantId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim(); const legalName = optionalText(formData.get("legalName"), 200); const description = optionalText(formData.get("description"), 5000); const contactEmail = optionalText(formData.get("contactEmail"), 320); const contactPhone = optionalText(formData.get("contactPhone"), 40); const contactPhoneSecondary = optionalText(formData.get("contactPhoneSecondary"), 40); const businessAddress = optionalText(formData.get("businessAddress"), 500); const defaultTimezone = String(formData.get("defaultTimezone") ?? "").trim();
  if (!UUID_PATTERN.test(merchantId) || displayName.length < 2 || displayName.length > 160 || legalName === undefined || description === undefined || contactEmail === undefined || contactPhone === undefined || contactPhoneSecondary === undefined || businessAddress === undefined || !defaultTimezone || defaultTimezone.length > 64) redirect(merchantDetailUrl(merchantId, "error", "Check the merchant profile values."));
  const db = getDb(); const [before] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1); if (!before) redirect("/admin/merchants?error=Merchant%20not%20found.");
  const after = { displayName, legalName, description, contactEmail, contactPhone, contactPhoneSecondary, businessAddress, defaultTimezone };
  await db.batch([db.update(merchants).set({ ...after, updatedAt: new Date() }).where(eq(merchants.id, merchantId)), db.insert(auditEvents).values({ merchantId, actorUserId: admin.id, action: "platform.merchant.profile_overridden", targetType: "merchant", targetId: merchantId, before: { displayName: before.displayName, legalName: before.legalName, description: before.description, contactEmail: before.contactEmail, contactPhone: before.contactPhone, contactPhoneSecondary: before.contactPhoneSecondary, businessAddress: before.businessAddress, defaultTimezone: before.defaultTimezone }, after })]);
  revalidatePath(`/admin/merchants/${merchantId}`); revalidatePath(`/${before.slug}`); redirect(merchantDetailUrl(merchantId, "success", "Merchant profile updated."));
}

export async function updateSiteOverride(formData: FormData) {
  const admin = await requirePlatformAdmin(); const merchantId = String(formData.get("merchantId") ?? ""); const siteId = String(formData.get("siteId") ?? ""); const name = String(formData.get("name") ?? "").trim(); const status = String(formData.get("status") ?? "");
  const description = optionalText(formData.get("description"), 5000); const addressLine1 = String(formData.get("addressLine1") ?? "").trim(); const addressLine2 = optionalText(formData.get("addressLine2"), 200); const city = String(formData.get("city") ?? "").trim(); const province = optionalText(formData.get("province"), 100); const postalCode = optionalText(formData.get("postalCode"), 20); const timezone = String(formData.get("timezone") ?? "").trim(); const contactEmail = optionalText(formData.get("contactEmail"), 320); const contactPhone = optionalText(formData.get("contactPhone"), 40); const latitude = coordinate(formData.get("latitude"), -90, 90); const longitude = coordinate(formData.get("longitude"), -180, 180); const bookingLeadMinutes = Number(formData.get("bookingLeadMinutes")); const advanceBookingDays = Number(formData.get("advanceBookingDays")); const manualPaymentDeadlineMinutes = Number(formData.get("manualPaymentDeadlineMinutes")); const taxRate = percentToBasisPoints(formData.get("taxPercentage"));
  if (!UUID_PATTERN.test(merchantId) || !UUID_PATTERN.test(siteId) || name.length < 2 || name.length > 160 || !new Set(["draft", "active", "inactive"]).has(status) || description === undefined || !addressLine1 || addressLine1.length > 200 || addressLine2 === undefined || !city || city.length > 100 || province === undefined || postalCode === undefined || !timezone || timezone.length > 64 || contactEmail === undefined || contactPhone === undefined || latitude === undefined || longitude === undefined || (latitude === null) !== (longitude === null) || !Number.isInteger(bookingLeadMinutes) || bookingLeadMinutes < 0 || !Number.isInteger(advanceBookingDays) || advanceBookingDays < 1 || !Number.isInteger(manualPaymentDeadlineMinutes) || manualPaymentDeadlineMinutes < 1 || taxRate === null) redirect(merchantDetailUrl(merchantId, "error", "Check the site configuration values."));
  const db = getDb(); const [before] = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.merchantId, merchantId))).limit(1); if (!before) redirect(merchantDetailUrl(merchantId, "error", "Site not found."));
  const manualPaymentInstructions = optionalText(formData.get("manualPaymentInstructions"), 5000); if (manualPaymentInstructions === undefined) redirect(merchantDetailUrl(merchantId, "error", "Manual payment instructions are too long."));
  const enabledProviders = new Set(formData.getAll("manualPaymentProviders").map(String));
  const manualPaymentOptions = normalizeManualPaymentOptions(before.manualPaymentOptions).map((option) => ({ ...option, enabled: enabledProviders.has(option.provider) }));
  const after = { name, status: status as typeof before.status, description, addressLine1, addressLine2, city, province, postalCode, timezone, contactEmail, contactPhone, latitude, longitude, amenities: commaList(formData.get("amenities")), bookingLeadMinutes, advanceBookingDays, onlinePaymentEnabled: formData.get("onlinePaymentEnabled") === "on", manualPaymentEnabled: formData.get("manualPaymentEnabled") === "on", manualPaymentDeadlineMinutes, manualPaymentInstructions, manualPaymentOptions, taxInclusive: formData.get("taxInclusive") === "on", taxBasisPoints: taxRate };
  await db.batch([db.update(sites).set({ ...after, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.merchantId, merchantId))), db.insert(auditEvents).values({ merchantId, actorUserId: admin.id, action: "platform.site.overridden", targetType: "site", targetId: siteId, before: { name: before.name, status: before.status, latitude: before.latitude, longitude: before.longitude, onlinePaymentEnabled: before.onlinePaymentEnabled, manualPaymentEnabled: before.manualPaymentEnabled }, after })]);
  revalidatePath(`/admin/merchants/${merchantId}`); revalidatePath(`/${(await db.select({ slug: merchants.slug }).from(merchants).where(eq(merchants.id, merchantId)).limit(1))[0]?.slug}/${before.slug}`); redirect(merchantDetailUrl(merchantId, "success", `${name} updated.`));
}

export async function updateCourtOverride(formData: FormData) {
  const admin = await requirePlatformAdmin(); const merchantId = String(formData.get("merchantId") ?? ""); const courtId = String(formData.get("courtId") ?? ""); const name = String(formData.get("name") ?? "").trim(); const status = String(formData.get("status") ?? ""); const description = optionalText(formData.get("description"), 5000); const surfaceType = optionalText(formData.get("surfaceType"), 100); const baseHourlyRateCents = pesoToCents(formData.get("baseHourlyRate")); const sortOrder = Number(formData.get("sortOrder"));
  if (!UUID_PATTERN.test(merchantId) || !UUID_PATTERN.test(courtId) || name.length < 1 || name.length > 120 || !new Set(["active", "inactive", "maintenance"]).has(status) || description === undefined || surfaceType === undefined || baseHourlyRateCents === null || !Number.isInteger(sortOrder) || sortOrder < 0) redirect(merchantDetailUrl(merchantId, "error", "Check the court configuration values."));
  const db = getDb(); const [before] = await db.select().from(courts).where(and(eq(courts.id, courtId), eq(courts.merchantId, merchantId))).limit(1); if (!before) redirect(merchantDetailUrl(merchantId, "error", "Court not found."));
  const after = { name, status: status as typeof before.status, description, surfaceType, baseHourlyRateCents, indoor: formData.get("indoor") === "on", amenities: commaList(formData.get("amenities")), sortOrder };
  await db.batch([db.update(courts).set({ ...after, updatedAt: new Date() }).where(and(eq(courts.id, courtId), eq(courts.merchantId, merchantId))), db.insert(auditEvents).values({ merchantId, actorUserId: admin.id, action: "platform.court.overridden", targetType: "court", targetId: courtId, before: { name: before.name, status: before.status, baseHourlyRateCents: before.baseHourlyRateCents }, after })]);
  revalidatePath(`/admin/merchants/${merchantId}`); redirect(merchantDetailUrl(merchantId, "success", `${name} updated.`));
}

export async function updateInvoiceStatus(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowedStatuses = new Set(["issued", "paid", "past_due", "void"]);
  if (!UUID_PATTERN.test(invoiceId) || !allowedStatuses.has(status)) {
    redirect("/admin/invoices?error=Invalid%20invoice%20update.");
  }

  const db = getDb();
  const [invoice] = await db
    .select({
      id: subscriptionInvoices.id,
      merchantId: subscriptionInvoices.merchantId,
      invoiceNumber: subscriptionInvoices.invoiceNumber,
      status: subscriptionInvoices.status,
    })
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.id, invoiceId))
    .limit(1);
  if (!invoice) redirect("/admin/invoices?error=Invoice%20not%20found.");

  const now = new Date();
  await db.batch([
    db
      .update(subscriptionInvoices)
      .set({
        status: status as "issued" | "paid" | "past_due" | "void",
        paidAt: status === "paid" ? now : null,
        updatedAt: now,
      })
      .where(eq(subscriptionInvoices.id, invoice.id)),
    db.insert(auditEvents).values({
      merchantId: invoice.merchantId,
      actorUserId: admin.id,
      action: "platform.subscription.invoice_status_updated",
      targetType: "subscription_invoice",
      targetId: invoice.id,
      before: { status: invoice.status },
      after: { status, paidAt: status === "paid" ? now : null },
      metadata: { invoiceNumber: invoice.invoiceNumber },
    }),
  ]);

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices?success=${encodeURIComponent(`${invoice.invoiceNumber} updated.`)}`);
}
