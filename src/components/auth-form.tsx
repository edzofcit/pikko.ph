"use client";

import Link from "next/link";
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
  audience,
  callbackUrl,
}: {
  mode: "sign-in" | "sign-up";
  audience: "customer" | "merchant" | "admin";
  callbackUrl: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === "sign-up";
  const isCustomer = audience === "customer";
  const isAdmin = audience === "admin";

  async function signInWithGoogle() {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Google authentication failed. Please try again.",
        );
        setSubmitting(false);
      }
    } catch (authenticationError) {
      setError(getAuthenticationErrorMessage(authenticationError));
      setSubmitting(false);
    }
  }

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

      // Start a fresh document request so the protected destination is checked
      // with the session cookie that the auth response just issued.
      window.location.assign(callbackUrl);
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
        {isAdmin
          ? "Platform administration"
          : isCustomer
          ? isSignUp
            ? "Create a customer account"
            : "Customer access"
          : isSignUp
            ? "Create merchant access"
            : "Merchant and admin access"}
      </p>
      <h1 className="display-type mt-3 text-4xl font-black">
        {isAdmin
          ? "Pikko admin"
          : isSignUp
          ? isCustomer
            ? "Save your court time."
            : "Join Pikko.ph"
          : isCustomer
            ? "Ready to play?"
            : "Welcome back"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        {isAdmin
          ? "Continue with the authorized Google Workspace account to manage the Pikko.ph platform."
          : isCustomer
          ? isSignUp
            ? "Use one account to see bookings made with your verified email."
            : "Sign in to view your bookings and find another court."
          : isSignUp
            ? "Use the same email your merchant owner invited, or create an account to list a venue."
            : "Sign in to manage your merchant or platform workspace."}
      </p>

      {isAdmin ? (
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={submitting}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-full border border-[var(--line)] bg-white px-5 py-3.5 text-sm font-bold text-[var(--forest)] shadow-sm transition hover:bg-[var(--cream)] disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.7c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.8A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.5 13.8a6 6 0 0 1 0-3.7V7.4H3.1a10 10 0 0 0 0 9.2l3.4-2.8Z" />
            <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 6.1Z" />
          </svg>
          {submitting ? "Opening Google…" : "Continue with Google"}
        </button>
      ) : (
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
            <span className="relative mt-2 block">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-[var(--line)] py-3 pl-4 pr-12 font-normal"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[var(--text-muted)] hover:text-[var(--forest)]"
              >
                {showPassword ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.4A10.8 10.8 0 0 1 12 4.2c4.7 0 8.3 3.7 9.5 7.1.2.5.2.9 0 1.4a12.8 12.8 0 0 1-2.4 3.8M6.2 6.2A12.4 12.4 0 0 0 2.5 11.3c-.2.5-.2.9 0 1.4 1.2 3.4 4.8 7.1 9.5 7.1 1.3 0 2.5-.3 3.6-.8" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 11.3C3.7 7.9 7.3 4.2 12 4.2s8.3 3.7 9.5 7.1c.2.5.2.9 0 1.4-1.2 3.4-4.8 7.1-9.5 7.1s-8.3-3.7-9.5-7.1a2 2 0 0 1 0-1.4Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </span>
          </label>
        </div>
      )}

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

      {!isAdmin ? (
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-[var(--forest)] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {submitting ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
        </button>
      ) : null}

      {!isAdmin ? (
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <Link
            href={`${isSignUp ? "/auth/sign-in" : "/auth/sign-up"}?audience=${audience}&callbackURL=${encodeURIComponent(callbackUrl)}`}
            className="font-bold text-[var(--forest)] underline underline-offset-4"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </Link>
        </p>
      ) : null}

      {!isAdmin ? (
        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          {isCustomer ? "Managing a venue?" : "Booking for yourself?"}{" "}
          <Link
            href={`/auth/${mode}?audience=${isCustomer ? "merchant" : "customer"}&callbackURL=${encodeURIComponent(isCustomer ? "/merchant" : "/customer")}`}
            className="font-black text-[var(--forest)] underline underline-offset-4"
          >
            {isCustomer ? "Merchant login" : "Customer login"}
          </Link>
        </p>
      ) : (
        <p className="mt-5 text-center text-xs leading-5 text-[var(--text-muted)]">
          Only the verified Google account for eddie@dxform.ph is authorized.
        </p>
      )}
    </form>
  );
}
