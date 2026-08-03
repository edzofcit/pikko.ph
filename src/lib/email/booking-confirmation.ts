import "server-only";

import { Resend } from "resend";
import { formatPeso } from "@/lib/money";
import { pikkoEmailSender } from "./sender";

type BookingEmailSlot = {
  startsAt: Date;
  endsAt: Date;
};

export type BookingCreatedEmail = {
  bookingId: string;
  bookingUrl: string;
  merchantBookingUrl: string;
  customerEmail: string;
  customerName: string;
  customerMobileNumber: string;
  merchantEmail: string | null;
  reference: string;
  merchantName: string;
  siteName: string;
  courtName: string;
  timezone: string;
  slots: BookingEmailSlot[];
  totalCents: number;
  paymentMethod: "manual" | "maya";
  paymentDueAt: Date;
  manualPaymentInstructions: string | null;
};

type Message = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

function scheduleLines(slots: BookingEmailSlot[], timezone: string) {
  return slots.map(
    (slot) =>
      `${formatDateTime(slot.startsAt, timezone)} – ${new Intl.DateTimeFormat("en-PH", {
        timeZone: timezone,
        timeStyle: "short",
      }).format(slot.endsAt)}`,
  );
}

function shell({
  preheader,
  eyebrow,
  heading,
  intro,
  content,
}: {
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  content: string;
}) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f2e8;color:#153d31;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <div style="max-width:620px;margin:0 auto;padding:28px 14px 40px;">
      <div style="padding:0 8px 18px;font-size:18px;font-weight:900;letter-spacing:-0.4px;">pikko<span style="color:#ff7358;">.ph</span></div>
      <div style="overflow:hidden;border-radius:26px;background:#153d31;color:#ffffff;box-shadow:0 16px 40px rgba(21,61,49,.14);">
        <div style="height:7px;background:#efff28;"></div>
        <div style="padding:32px 28px;">
          <div style="font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#efff28;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:12px 0 0;font-size:34px;line-height:1.12;letter-spacing:-1px;">${escapeHtml(heading)}</h1>
          <p style="margin:15px 0 0;color:#d5e2dc;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
        </div>
      </div>
      ${content}
      <p style="margin:20px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#718078;">Pikko.ph · Find your court. Pick your hour. Play.</p>
    </div>
  </body>
</html>`;
}

function detailRow(label: string, value: string) {
  return `<div style="padding:13px 0;border-bottom:1px solid #e7e8df;">
    <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#78847e;">${escapeHtml(label)}</div>
    <div style="margin-top:5px;font-size:15px;font-weight:750;line-height:1.5;color:#153d31;">${escapeHtml(value)}</div>
  </div>`;
}

function actionButton(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="display:block;margin-top:24px;padding:16px 22px;border-radius:999px;background:#efff28;color:#153d31;text-decoration:none;text-align:center;font-size:15px;font-weight:900;">${escapeHtml(label)} &rarr;</a>`;
}

function customerMessage(booking: BookingCreatedEmail, schedules: string[]): Message {
  const paymentLabel = booking.paymentMethod === "maya" ? "Maya QR payment" : "Manual payment";
  const instructions = booking.manualPaymentInstructions?.trim();
  const text = [
    `Hi ${booking.customerName},`,
    "",
    `We received your booking request for ${booking.siteName}.`,
    `Reference: ${booking.reference}`,
    `Court: ${booking.courtName}`,
    ...schedules.map((schedule) => `Schedule: ${schedule}`),
    `Total: ${formatPeso(booking.totalCents)}`,
    `Payment: ${paymentLabel}`,
    `Complete payment by: ${formatDateTime(booking.paymentDueAt, booking.timezone)}`,
    instructions ? `Payment instructions: ${instructions}` : "",
    "",
    "Open your private booking page to complete payment, upload proof, or check the latest status:",
    booking.bookingUrl,
    "",
    "Keep this private link secure. Anyone with it can view this booking.",
  ].filter(Boolean).join("\n");

  const scheduleRows = schedules.map((schedule) => detailRow("Schedule", schedule)).join("");
  const instructionCard = instructions
    ? `<div style="margin-top:18px;padding:17px;border-radius:16px;background:#f5f2e8;color:#354b42;white-space:pre-wrap;font-size:14px;line-height:1.65;"><strong style="color:#153d31;">Payment instructions</strong><br>${escapeHtml(instructions)}</div>`
    : "";
  const html = shell({
    preheader: `Booking ${booking.reference} received. Return to your booking anytime with this private link.`,
    eyebrow: "Booking received",
    heading: "Your court is one step away.",
    intro: `Hi ${booking.customerName}, we saved your booking request with ${booking.merchantName}. Complete payment before the deadline to secure your court.`,
    content: `<div style="margin-top:16px;padding:26px;border:1px solid #dfe3db;border-radius:22px;background:#ffffff;box-shadow:0 10px 30px rgba(21,61,49,.06);">
      <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#fff4d6;color:#74521b;font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;">Awaiting payment</div>
      ${detailRow("Booking reference", booking.reference)}
      ${detailRow("Venue", `${booking.merchantName} · ${booking.siteName}`)}
      ${detailRow("Court", booking.courtName)}
      ${scheduleRows}
      ${detailRow("Payment option", paymentLabel)}
      ${detailRow("Payment deadline", formatDateTime(booking.paymentDueAt, booking.timezone))}
      <div style="padding-top:18px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#78847e;">Total due</div>
        <div style="margin-top:5px;font-size:30px;font-weight:900;letter-spacing:-1px;">${escapeHtml(formatPeso(booking.totalCents))}</div>
      </div>
      ${instructionCard}
      ${actionButton("Open my booking", booking.bookingUrl)}
      <p style="margin:14px 4px 0;font-size:12px;line-height:1.55;color:#78847e;">This button contains your private booking link. Please do not forward this email.</p>
    </div>`,
  });

  return {
    to: booking.customerEmail,
    subject: `Booking received · ${booking.reference} · ${booking.siteName}`,
    text,
    html,
    idempotencyKey: `booking-created-customer-${booking.bookingId}`,
  };
}

function merchantMessage(booking: BookingCreatedEmail, schedules: string[]): Message | null {
  if (!booking.merchantEmail) return null;
  const paymentLabel = booking.paymentMethod === "maya" ? "Maya QR" : "Manual payment";
  const text = [
    `A new booking was created at ${booking.siteName}.`,
    "",
    `Reference: ${booking.reference}`,
    `Customer: ${booking.customerName}`,
    `Email: ${booking.customerEmail}`,
    `Mobile: ${booking.customerMobileNumber}`,
    `Court: ${booking.courtName}`,
    ...schedules.map((schedule) => `Schedule: ${schedule}`),
    `Total: ${formatPeso(booking.totalCents)}`,
    `Payment: ${paymentLabel} — pending`,
    "",
    "Open the booking in your Partner Dashboard:",
    booking.merchantBookingUrl,
  ].join("\n");

  const html = shell({
    preheader: `New booking ${booking.reference} at ${booking.siteName}.`,
    eyebrow: "New booking",
    heading: "A player just chose your court.",
    intro: `${booking.customerName} created a booking at ${booking.siteName}. Payment is still pending.`,
    content: `<div style="margin-top:16px;padding:26px;border:1px solid #dfe3db;border-radius:22px;background:#ffffff;box-shadow:0 10px 30px rgba(21,61,49,.06);">
      <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#eaf7ee;color:#21613f;font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;">New request</div>
      ${detailRow("Booking reference", booking.reference)}
      ${detailRow("Customer", booking.customerName)}
      ${detailRow("Contact", `${booking.customerEmail} · ${booking.customerMobileNumber}`)}
      ${detailRow("Venue", booking.siteName)}
      ${detailRow("Court", booking.courtName)}
      ${schedules.map((schedule) => detailRow("Schedule", schedule)).join("")}
      ${detailRow("Payment", `${paymentLabel} · Pending`)}
      <div style="padding-top:18px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#78847e;">Booking value</div>
        <div style="margin-top:5px;font-size:30px;font-weight:900;letter-spacing:-1px;">${escapeHtml(formatPeso(booking.totalCents))}</div>
      </div>
      ${actionButton("Review in Partner Dashboard", booking.merchantBookingUrl)}
    </div>`,
  });

  return {
    to: booking.merchantEmail,
    subject: `New booking · ${booking.reference} · ${booking.siteName}`,
    text,
    html,
    idempotencyKey: `booking-created-merchant-${booking.bookingId}`,
  };
}

async function sendMessage(resend: Resend, from: string, message: Message) {
  const { data, error } = await resend.emails.send(
    {
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    },
    { idempotencyKey: message.idempotencyKey },
  );
  if (error) throw new Error(`Resend rejected email to ${message.to}: ${error.message}`);
  return data?.id ?? null;
}

export async function sendBookingCreatedEmails(booking: BookingCreatedEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`Booking emails skipped for ${booking.reference}: RESEND_API_KEY is not configured.`);
    return { sent: false as const, reason: "not_configured" as const };
  }

  const resend = new Resend(apiKey);
  const from = pikkoEmailSender();
  const schedules = scheduleLines(booking.slots, booking.timezone);
  const customer = customerMessage(booking, schedules);
  const merchant = merchantMessage(booking, schedules);
  const messages = merchant ? [customer, merchant] : [customer];
  const results = await Promise.allSettled(
    messages.map((message) => sendMessage(resend, from, message)),
  );
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `One or more booking emails failed for ${booking.reference}.`,
    );
  }

  if (!merchant) {
    console.warn(`Merchant email skipped for ${booking.reference}: no site or merchant contact email is configured.`);
  }

  return {
    sent: true as const,
    customerEmailId: results[0]?.status === "fulfilled" ? results[0].value : null,
    merchantEmailId: merchant && results[1]?.status === "fulfilled" ? results[1].value : null,
    merchantSkipped: !merchant,
  };
}
