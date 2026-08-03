"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

export function PasswordForm() {
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");

    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(result.error.message || "Your password could not be changed.");
        return;
      }
      form.reset();
      setSuccess("Password changed. Other signed-in sessions have been revoked.");
    } catch {
      setError("Your password could not be changed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <label className="block text-sm font-black">Current password<input name="currentPassword" type={showPasswords ? "text" : "password"} required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-black">New password<input name="newPassword" type={showPasswords ? "text" : "password"} required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
      <label className="block text-sm font-black">Confirm new password<input name="confirmation" type={showPasswords ? "text" : "password"} required minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
      <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-muted)]"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} /> Show passwords</label>
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p> : null}
      {success ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{success}</p> : null}
      <button disabled={submitting} className="rounded-full bg-[var(--forest)] px-6 py-3 text-sm font-black text-white disabled:opacity-60">{submitting ? "Updating…" : "Change password"}</button>
    </form>
  );
}
