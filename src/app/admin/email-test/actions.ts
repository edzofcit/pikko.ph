"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { pikkoEmailSender } from "@/lib/email/sender";
import { requirePlatformAdmin } from "@/lib/auth/access";

type TestMode = "provider" | "admin";

function mailerUrl(
  kind: "success" | "error",
  code: string,
  messageId?: string | null,
) {
  const query = new URLSearchParams({ [kind]: code });
  if (messageId) query.set("messageId", messageId);
  return `/admin/email-test?${query.toString()}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendAdminTestEmail(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const requestedMode = String(formData.get("mode") ?? "");
  if (requestedMode !== "provider" && requestedMode !== "admin") {
    redirect(mailerUrl("error", "invalid-mode"));
  }
  const mode = requestedMode as TestMode;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    redirect(mailerUrl("error", "not-configured"));
  }

  const recipient = mode === "provider" ? "delivered@resend.dev" : admin.email;
  const sentAt = new Date();
  let messageId: string | null = null;
  let sendFailed = false;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from: pikkoEmailSender(),
        to: recipient,
        subject: "Pikko.ph server-side mailer test",
        text: [
          `Hi ${admin.fullName},`,
          "",
          "The Pikko.ph server-side mailer is connected to Resend.",
          `Test mode: ${mode === "provider" ? "Provider delivery simulation" : "Administrator inbox"}`,
          `Generated: ${sentAt.toISOString()}`,
          "",
          "No customer booking or payment data was used for this test.",
        ].join("\n"),
        html: `
          <!doctype html>
          <html lang="en">
            <body style="margin:0;background:#f7f5eb;color:#173d32;font-family:Arial,sans-serif;">
              <div style="max-width:560px;margin:0 auto;padding:32px 18px;">
                <div style="background:#173d32;border-radius:24px;padding:30px;color:#ffffff;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c9f46a;">Server-side mailer</div>
                  <h1 style="margin:12px 0 0;font-size:32px;line-height:1.15;">Pikko email is connected.</h1>
                  <p style="margin:16px 0 0;color:#d9e5df;line-height:1.6;">Hi ${escapeHtml(admin.fullName)}, Resend accepted this message from the protected platform-admin mailer.</p>
                </div>
                <div style="margin-top:18px;padding:24px;border:1px solid #d9ddd5;border-radius:20px;background:#ffffff;">
                  <p style="margin:0;font-size:13px;color:#68756f;">Test mode</p>
                  <p style="margin:6px 0 0;font-weight:800;">${mode === "provider" ? "Provider delivery simulation" : "Administrator inbox"}</p>
                  <p style="margin:20px 0 0;font-size:13px;color:#68756f;">Generated server-side</p>
                  <p style="margin:6px 0 0;font-family:monospace;">${escapeHtml(sentAt.toISOString())}</p>
                  <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#68756f;">No customer booking or payment data was included.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      },
      { idempotencyKey: `admin-mailer-test-${randomUUID()}` },
    );

    if (error) {
      console.error("Admin mailer test rejected by Resend", {
        name: error.name,
        message: error.message,
      });
      sendFailed = true;
    } else {
      messageId = data?.id ?? null;
    }
  } catch (error) {
    console.error("Admin mailer test failed", error);
    sendFailed = true;
  }

  if (sendFailed) {
    redirect(
      mailerUrl(
        "error",
        mode === "admin" ? "admin-recipient-failed" : "provider-failed",
      ),
    );
  }

  redirect(
    mailerUrl(
      "success",
      mode === "provider" ? "provider-accepted" : "admin-accepted",
      messageId,
    ),
  );
}
