"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function MayaPaymentPanel({
  paymentId,
  accessToken,
  qrDataUrl,
  mayaUrl,
  initiallyPaid,
}: {
  paymentId: string;
  accessToken: string;
  qrDataUrl: string;
  mayaUrl: string;
  initiallyPaid: boolean;
}) {
  const [outcome, setOutcome] = useState(initiallyPaid ? "paid" : "pending");
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    setChecking(true);
    try {
      const response = await fetch("/api/payments/maya/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, token: accessToken }),
      });
      const result = await response.json() as { outcome?: string };
      if (result.outcome === "paid" || result.outcome === "failed") setOutcome(result.outcome);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (outcome !== "pending") return;
    const interval = window.setInterval(() => void checkStatus(), 5_000);
    return () => window.clearInterval(interval);
  // checkStatus only uses stable props and state setters; polling stops once outcome changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  if (outcome === "paid") {
    return <div className="rounded-2xl bg-[var(--mint)] p-5 text-center text-[var(--forest)]"><p className="text-lg font-black">Payment confirmed</p><p className="mt-2 text-sm">Your court booking is confirmed. Refresh this page to see the updated booking status.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Refresh booking</button></div>;
  }
  if (outcome === "failed") {
    return <div className="rounded-2xl bg-red-50 p-5 text-center text-red-800"><p className="text-lg font-black">Payment was not completed</p><p className="mt-2 text-sm">The temporary court hold has been released.</p></div>;
  }
  return <div>
    <div className="mx-auto max-w-sm rounded-3xl border border-[var(--line)] bg-white p-4 shadow-sm"><Image src={qrDataUrl} alt="One-time Maya QRPh payment code" width={800} height={800} unoptimized className="h-auto w-full rounded-2xl" /></div>
    <p className="mt-4 text-center text-sm leading-6 text-[var(--text-muted)]">Scan this one-time QRPh code using Maya or another participating banking app. It expires one hour after creation.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><a href={mayaUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white">Open Maya payment page</a><button type="button" onClick={() => void checkStatus()} disabled={checking} className="min-h-12 rounded-full border border-[var(--forest)] px-5 text-sm font-black text-[var(--forest)] disabled:opacity-60">{checking ? "Checking…" : "I’ve paid · Check status"}</button></div>
    <p role="status" className="mt-4 text-center text-xs font-bold text-[var(--text-muted)]">Waiting for Maya payment confirmation…</p>
  </div>;
}
