"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth/client";

function getAuthenticationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

export function AuthForm({
  mode,
  callbackUrl,
}: {
  mode: "sign-in" | "sign-up";
  callbackUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(
          result.error.message || "Authentication failed. Please try again.",
        );
        return;
      }

      if (isSignUp && !result.data.token) {
        setNotice(
          "Account created. Check your email to verify it, then return here to sign in.",
        );
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch (authenticationError) {
      setError(getAuthenticationErrorMessage(authenticationError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_20px_70px_rgb(23_60_42_/_12%)] sm:p-8"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral)]">
        {isSignUp ? "Create your account" : "Merchant and admin access"}
      </p>
      <h1 className="display-type mt-3 text-4xl font-black">
        {isSignUp ? "Join Pikko.ph" : "Welcome back"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        {isSignUp
          ? "Use the same email your merchant owner invited."
          : "Sign in to your assigned merchant or platform workspace."}
      </p>

      <div className="mt-7 space-y-5">
        {isSignUp ? (
          <label className="block text-sm font-bold">
            Full name
            <input
              name="name"
              required
              minLength={2}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
            />
          </label>
        ) : null}
        <label className="block text-sm font-bold">
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-[var(--forest)] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {submitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={`${isSignUp ? "/auth/sign-in" : "/auth/sign-up"}?callbackURL=${encodeURIComponent(callbackUrl)}`}
          className="font-bold text-[var(--forest)] underline underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
