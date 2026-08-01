"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function AccountButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold disabled:opacity-60"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
