import "server-only";

export function pikkoEmailSender() {
  const configuredSender = process.env.EMAIL_FROM?.trim();
  if (configuredSender) return configuredSender;

  const configuredDomain = process.env.RESEND_EMAIL_DOMAIN
    ?.trim()
    .toLowerCase();
  if (configuredDomain && /^[a-z0-9.-]+$/.test(configuredDomain)) {
    return `Pikko.ph <bookings@${configuredDomain}>`;
  }

  return "Pikko.ph <onboarding@resend.dev>";
}
