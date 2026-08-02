"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { getDb } from "@/db";
import {
  auditEvents,
  merchantMemberships,
  merchants,
  subscriptionInvoices,
  users,
} from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { processSubscriptionBilling } from "@/lib/billing/subscriptions";
import { pikkoEmailSender } from "@/lib/email/sender";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appUrl() {
  return (process.env.APP_URL?.trim() || "https://pikko-ph.vercel.app").replace(/\/$/, "");
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
      monthlyCourtPriceCents: 59900,
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
        monthlyCourtPriceCents: 59900,
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
          "After the trial, billing starts at PHP 599 per active court per month unless your platform rate is changed.",
        ].join("\n"),
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#173d32"><h1>Welcome to Pikko.ph</h1><p>Hi ${escapeHtml(ownerName)},</p><p><strong>${escapeHtml(displayName)}</strong> is ready with a 14-day trial.</p><div style="padding:18px;border-radius:14px;background:#f7f5eb"><p><strong>Login:</strong> ${escapeHtml(ownerEmail)}</p><p><strong>Temporary password:</strong> <code>${escapeHtml(temporaryPassword)}</code></p></div><p><a href="${escapeHtml(signInUrl)}">Sign in to your merchant dashboard</a></p><p>For security, <a href="${escapeHtml(securityUrl)}">change the temporary password</a> after your first sign-in. Billing begins after the trial at PHP 599 per active court per month unless your platform rate is changed.</p></div>`,
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
