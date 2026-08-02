export const MANUAL_PAYMENT_PROVIDERS = [
  { id: "qrph", label: "QRPH" },
  { id: "maya", label: "Maya" },
  { id: "gcash", label: "GCash" },
  { id: "gotyme", label: "GoTyme" },
] as const;

export type ManualPaymentProvider =
  (typeof MANUAL_PAYMENT_PROVIDERS)[number]["id"];

export type ManualPaymentOption = {
  provider: ManualPaymentProvider;
  label: string;
  qrImageUrl: string;
  qrImagePathname: string;
};

const providerIds = new Set<string>(
  MANUAL_PAYMENT_PROVIDERS.map((provider) => provider.id),
);

export function isManualPaymentProvider(
  value: string,
): value is ManualPaymentProvider {
  return providerIds.has(value);
}

export function normalizeManualPaymentOptions(
  value: unknown,
): ManualPaymentOption[] {
  if (!Array.isArray(value)) return [];

  const options = new Map<ManualPaymentProvider, ManualPaymentOption>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const option = candidate as Record<string, unknown>;
    const provider = String(option.provider ?? "");
    const label = String(option.label ?? "").trim();
    const qrImageUrl = String(option.qrImageUrl ?? "").trim();
    const qrImagePathname = String(option.qrImagePathname ?? "").trim();
    if (
      !isManualPaymentProvider(provider) ||
      !label ||
      !qrImageUrl.startsWith("https://") ||
      !qrImagePathname
    ) {
      continue;
    }
    options.set(provider, {
      provider,
      label: label.slice(0, 40),
      qrImageUrl,
      qrImagePathname,
    });
  }

  return MANUAL_PAYMENT_PROVIDERS.flatMap((provider) => {
    const option = options.get(provider.id);
    return option ? [option] : [];
  });
}
