"use client";

import Image from "next/image";
import { useState } from "react";
import type {
  ManualPaymentOption,
  ManualPaymentProvider,
} from "@/lib/manual-payment/options";

export function ManualPaymentQrSelector({
  options,
  initialProvider,
  inputName,
  tone = "light",
}: {
  options: ManualPaymentOption[];
  initialProvider?: ManualPaymentProvider | null;
  inputName?: string;
  tone?: "light" | "dark";
}) {
  const initialOption =
    options.find((option) => option.provider === initialProvider) ?? options[0];
  const [selectedProvider, setSelectedProvider] =
    useState<ManualPaymentProvider | null>(initialOption?.provider ?? null);
  const selectedOption =
    options.find((option) => option.provider === selectedProvider) ?? options[0];
  const mutedText = tone === "dark" ? "text-white/65" : "text-[var(--text-muted)]";

  if (!selectedOption) {
    return (
      <p className={`rounded-2xl border border-dashed p-4 text-sm ${tone === "dark" ? "border-white/20 bg-white/5 text-white/70" : "border-[var(--line)] bg-[var(--paper)] text-[var(--text-muted)]"}`}>
        Follow the merchant&apos;s written payment instructions below.
      </p>
    );
  }

  return (
    <section aria-label="Manual payment QR options">
      {inputName ? (
        <input type="hidden" name={inputName} value={selectedOption.provider} />
      ) : null}
      <p className={`text-xs font-black uppercase tracking-[0.18em] ${mutedText}`}>
        Scan to pay
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Choose payment channel">
        {options.map((option) => {
          const selected = option.provider === selectedOption.provider;
          return (
            <button
              key={option.provider}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedProvider(option.provider)}
              className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${
                selected
                  ? tone === "dark"
                    ? "bg-[var(--lime)] text-[var(--ink)]"
                    : "bg-[var(--forest)] text-white"
                  : tone === "dark"
                    ? "bg-white/10 text-white/75 hover:bg-white/20"
                    : "bg-[var(--paper)] text-[var(--text-muted)] hover:text-[var(--forest)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <a
        href={selectedOption.qrImageUrl}
        target="_blank"
        rel="noreferrer"
        className={`mt-4 block overflow-hidden rounded-2xl border p-3 ${tone === "dark" ? "border-white/20 bg-white" : "border-[var(--line)] bg-white"}`}
        aria-label={`Enlarge ${selectedOption.label} payment QR`}
      >
        <Image
          src={selectedOption.qrImageUrl}
          alt={`${selectedOption.label} payment QR code`}
          width={900}
          height={900}
          sizes="(max-width: 1024px) 100vw, 352px"
          className="aspect-square h-auto w-full object-contain"
        />
      </a>
      <p className={`mt-3 text-center text-xs font-black uppercase tracking-wide ${mutedText}`}>
        {selectedOption.label} · Tap to enlarge
      </p>
    </section>
  );
}
