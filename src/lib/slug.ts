export function toSlug(value: string, fallback = "venue") {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || fallback;
}

const RESERVED_MERCHANT_SLUGS = new Set([
  "access-denied",
  "admin",
  "api",
  "auth",
  "favicon-ico",
  "icon-svg",
  "merchant",
  "next",
]);

export function toPublicMerchantSlug(value: string) {
  const slug = toSlug(value, "pickleball-club");
  return RESERVED_MERCHANT_SLUGS.has(slug) ? `${slug}-club` : slug;
}
