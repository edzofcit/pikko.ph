import "server-only";

import { Resend } from "resend";
import { formatPeso } from "@/lib/money";
import { pikkoEmailSender } from "./sender";

type BookingEmailSlot = {
  startsAt: Date;
  endsAt: Date;
};

type BookingConfirmationEmail = {
  bookingId: string;
  bookingUrl: string;
  customerEmail: string;
  customerName: string;
  reference: string;
  merchantName: string;
  siteName: string;
  courtName: string;
  timezone: string;
  slots: BookingEmailSlot[];
  totalCents: number;
  paymentDueAt: Date;
  manualPaymentInstructions: string | null;
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
      `${formatDateTime(slot.startsAt, timezone)}–${new Intl.DateTimeFormat("en-PH", {
        timeZone: timezone,
        timeStyle: "short",
      }).format(slot.endsAt)}`,
  );
}

export async function sendBookingConfirmationEmail(
  booking: BookingConfirmationEmail,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `Booking email skipped for ${booking.reference}: RESEND_API_KEY is not configured.`,
    );
    return { sent: false as const, reason: "not_configured" as const };
  }

  const resend = new Resend(apiKey);
  const from = pikkoEmailSender();
  const lines = scheduleLines(booking.slots, booking.timezone);
  const safeUrl = escapeHtml(booking.bookingUrl);
  const instructions = booking.manualPaymentInstructions?.trim();
  const { data, error } = await resend.emails.send(
    {
      from,
      to: booking.customerEmail,
      subject: `Your Pikko booking ${booking.reference}`,
      text: [
        `Hi ${booking.customerName},`,
        "",
        `Your booking request with ${booking.merchantName} at ${booking.siteName} has been received.`,
        `Court: ${booking.courtName}`,
        ...lines.map((line) => `Schedule: ${line}`),
        `Total: ${formatPeso(booking.totalCents)}`,
        `Payment deadline: ${formatDateTime(booking.paymentDueAt, booking.timezone)}`,
        instructions ? `Payment instructions: ${instructions}` : "",
        "",
        "Open and manage your booking using this private link:",
        booking.bookingUrl,
        "",
        "Keep this link private. Anyone with the link can view this booking.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <!doctype html>
        <html lang="en">
          <body style="margin:0;background:#f7f5eb;color:#173d32;font-family:Arial,sans-serif;">
            <div style="display:none;max-height:0;overflow:hidden;">Return to booking ${escapeHtml(booking.reference)} anytime using your private link.</div>
            <div style="max-width:600px;margin:0 auto;padding:32px 18px;">
              <div style="background:#173d32;border-radius:24px;padding:30px;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#c9f46a;">Booking received</div>
                <h1 style="margin:12px 0 0;font-size:32px;line-height:1.15;">Keep your booking link handy.</h1>
                <p style="margin:16px 0 0;color:#d9e5df;line-height:1.6;">Hi ${escapeHtml(booking.customerName)}, your request with ${escapeHtml(booking.merchantName)} has been recorded.</p>
              </div>
              <div style="background:#ffffff;border:1px solid #d9ddd5;border-radius:20px;margin-top:18px;padding:24px;">
                <div style="font-size:13px;color:#68756f;">Reference</div>
                <div style="margin-top:4px;font-size:20px;font-weight:800;">${escapeHtml(booking.reference)}</div>
                <div style="margin-top:20px;font-size:13px;color:#68756f;">Venue</div>
                <div style="margin-top:4px;font-weight:700;">${escapeHtml(booking.merchantName)} · ${escapeHtml(booking.siteName)}</div>
                <div style="margin-top:20px;font-size:13px;color:#68756f;">Court and schedule</div>
                <div style="margin-top:4px;font-weight:700;">${escapeHtml(booking.courtName)}</div>
                ${lines.map((line) => `<div style="margin-top:6px;line-height:1.5;">${escapeHtml(line)}</div>`).join("")}
                <div style="margin-top:20px;font-size:13px;color:#68756f;">Total due</div>
                <div style="margin-top:4px;font-size:24px;font-weight:800;">${escapeHtml(formatPeso(booking.totalCents))}</div>
                <div style="margin-top:8px;font-size:14px;color:#68756f;">Pay by ${escapeHtml(formatDateTime(booking.paymentDueAt, booking.timezone))}</div>
                ${instructions ? `<div style="margin-top:20px;padding:16px;border-radius:14px;background:#f7f5eb;white-space:pre-wrap;line-height:1.6;"><strong>Payment instructions</strong><br>${escapeHtml(instructions)}</div>` : ""}
                <a href="${safeUrl}" style="display:block;margin-top:24px;padding:15px 20px;border-radius:999px;background:#173d32;color:#ffffff;text-decoration:none;text-align:center;font-weight:800;">Open my booking</a>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#68756f;">This is a private management link. Do not forward it to anyone you do not trust.</p>
              </div>
              <p style="margin:18px 0 0;text-align:center;font-size:12px;color:#68756f;">Pikko.ph · Find your court. Pick your time. Play.</p>
            </div>
          </body>
        </html>
      `,
    },
    { idempotencyKey: `booking-received-${booking.bookingId}` },
  );

  if (error) {
    throw new Error(`Resend rejected booking email: ${error.message}`);
  }

  return { sent: true as const, emailId: data?.id ?? null };
}
