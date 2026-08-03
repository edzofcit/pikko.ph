import "server-only";

import { Resend } from "resend";
import { pikkoEmailSender } from "./sender";

type MerchantTrialEmail = {
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  ownerName: string;
  ownerEmail: string;
  contactPhone: string | null;
  trialEndsAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appUrl() {
  return (process.env.APP_URL?.trim() || "https://www.pikko.ph").replace(/\/$/, "");
}

function adminEmails() {
  return Array.from(
    new Set(
      (process.env.PIKKO_PLATFORM_ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  }).format(value);
}

function shell({ eyebrow, heading, intro, content }: { eyebrow: string; heading: string; intro: string; content: string }) {
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f2e8;color:#153d31;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:28px 14px 40px;">
    <div style="padding:0 8px 18px;font-size:18px;font-weight:900;">pikko<span style="color:#ff7358;">.ph</span></div>
    <div style="overflow:hidden;border-radius:26px;background:#153d31;color:#fff;box-shadow:0 16px 40px rgba(21,61,49,.14);">
      <div style="height:7px;background:#efff28;"></div>
      <div style="padding:32px 28px;"><div style="font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#efff28;">${escapeHtml(eyebrow)}</div><h1 style="margin:12px 0 0;font-size:34px;line-height:1.12;letter-spacing:-1px;">${escapeHtml(heading)}</h1><p style="margin:15px 0 0;color:#d5e2dc;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p></div>
    </div>
    ${content}
    <p style="margin:20px 0 0;text-align:center;font-size:12px;color:#718078;">Pikko.ph · More court time. Less admin time.</p>
  </div>
</body></html>`;
}

function button(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="display:block;margin-top:24px;padding:16px 22px;border-radius:999px;background:#efff28;color:#153d31;text-decoration:none;text-align:center;font-size:15px;font-weight:900;">${escapeHtml(label)} &rarr;</a>`;
}

async function send(
  resend: Resend,
  message: { to: string; subject: string; text: string; html: string; idempotencyKey: string },
) {
  const { data, error } = await resend.emails.send(
    { from: pikkoEmailSender(), to: message.to, subject: message.subject, text: message.text, html: message.html },
    { idempotencyKey: message.idempotencyKey },
  );
  if (error) throw new Error(`Resend rejected trial email to ${message.to}: ${error.message}`);
  return data?.id ?? null;
}

export async function sendMerchantTrialStartedEmails(trial: MerchantTrialEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`Merchant trial emails skipped for ${trial.merchantId}: RESEND_API_KEY is not configured.`);
    return { sent: false as const, reason: "not_configured" as const };
  }

  const origin = appUrl();
  const dashboardUrl = `${origin}/merchant`;
  const adminUrl = `${origin}/admin/merchants/${trial.merchantId}`;
  const trialEnd = formatDate(trial.trialEndsAt);
  const resend = new Resend(apiKey);
  const ownerMessage = {
    to: trial.ownerEmail,
    subject: `Your 14-day Pikko trial is ready · ${trial.merchantName}`,
    idempotencyKey: `merchant-trial-owner-${trial.merchantId}`,
    text: [
      `Hi ${trial.ownerName},`,
      "",
      `Your 14-day free trial for ${trial.merchantName} is now active until ${trialEnd}.`,
      "Start by adding your first site, courts, operating hours, rates, and payment options.",
      "",
      `Open Partner Dashboard: ${dashboardUrl}`,
      "",
      "Pikko will calculate subscription billing after the trial using the active-court rate configured for your account.",
    ].join("\n"),
    html: shell({
      eyebrow: "14-day free trial",
      heading: "Your partner workspace is ready.",
      intro: `Hi ${trial.ownerName}, welcome to Pikko. Your free trial for ${trial.merchantName} is active until ${trialEnd}.`,
      content: `<div style="margin-top:16px;padding:26px;border:1px solid #dfe3db;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(21,61,49,.06);">
        <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#eaf7ee;color:#21613f;font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;">Trial active</div>
        <h2 style="margin:20px 0 8px;font-size:22px;">Set up your booking experience</h2>
        <p style="margin:0;color:#617068;line-height:1.65;">Add your first site and courts, publish operating hours and rates, then configure manual or Maya QR payments.</p>
        <div style="margin-top:20px;padding:16px;border-radius:16px;background:#f5f2e8;"><div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#78847e;">Free trial ends</div><div style="margin-top:6px;font-size:20px;font-weight:900;">${escapeHtml(trialEnd)}</div></div>
        ${button("Open Partner Dashboard", dashboardUrl)}
        <p style="margin:14px 3px 0;font-size:12px;line-height:1.55;color:#78847e;">Subscription billing begins after the trial and is based on the active-court rate configured for your merchant account.</p>
      </div>`,
    }),
  };

  const administrators = adminEmails();
  const adminMessages = administrators.map((email) => ({
    to: email,
    subject: `New trial merchant · ${trial.merchantName}`,
    idempotencyKey: `merchant-trial-admin-${trial.merchantId}-${email}`,
    text: [
      "A new merchant started a 14-day Pikko trial.",
      "",
      `Merchant: ${trial.merchantName}`,
      `Owner: ${trial.ownerName}`,
      `Email: ${trial.ownerEmail}`,
      `Phone: ${trial.contactPhone || "Not provided"}`,
      `Trial ends: ${trialEnd}`,
      `Public slug: /${trial.merchantSlug}`,
      "",
      `Review merchant: ${adminUrl}`,
    ].join("\n"),
    html: shell({
      eyebrow: "New merchant signup",
      heading: "A new partner started a trial.",
      intro: `${trial.merchantName} created a merchant workspace and entered the 14-day trial period.`,
      content: `<div style="margin-top:16px;padding:26px;border:1px solid #dfe3db;border-radius:22px;background:#fff;box-shadow:0 10px 30px rgba(21,61,49,.06);">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#78847e;">Merchant</div><div style="margin-top:6px;font-size:24px;font-weight:900;">${escapeHtml(trial.merchantName)}</div>
        <div style="margin-top:20px;padding-top:18px;border-top:1px solid #e7e8df;color:#354b42;line-height:1.7;"><strong>Owner:</strong> ${escapeHtml(trial.ownerName)}<br><strong>Email:</strong> ${escapeHtml(trial.ownerEmail)}<br><strong>Phone:</strong> ${escapeHtml(trial.contactPhone || "Not provided")}<br><strong>Trial ends:</strong> ${escapeHtml(trialEnd)}</div>
        ${button("Review merchant account", adminUrl)}
      </div>`,
    }),
  }));

  if (administrators.length === 0) {
    console.warn(`Admin trial notification skipped for ${trial.merchantId}: no platform admin email is configured.`);
  }

  const messages = [ownerMessage, ...adminMessages];
  const results = await Promise.allSettled(messages.map((message) => send(resend, message)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `One or more merchant trial emails failed for ${trial.merchantId}.`,
    );
  }

  return { sent: true as const, ownerEmailId: results[0]?.status === "fulfilled" ? results[0].value : null, adminNotificationCount: administrators.length };
}
