import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getMerchantAccess } from "@/lib/auth/access";
import { createMerchantAccount } from "./actions";

export const metadata: Metadata = { title: "Create merchant account" };
export const dynamic = "force-dynamic";

const errors = {
  invalid: "Check the business name and contact details, then try again.",
  "membership-exists":
    "This account is already connected to a merchant workspace.",
} as const;

export default async function MerchantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [access, query] = await Promise.all([
    getMerchantAccess(),
    searchParams,
  ]);

  if (!access?.user) {
    redirect(
      `/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/onboarding")}`,
    );
  }

  if (access.membership) {
    redirect("/merchant");
  }

  const errorMessage = errors[query.error as keyof typeof errors];

  return (
    <DashboardShell
      eyebrow="Merchant onboarding"
      title="Start your 14-day free trial."
      description="Create your venue workspace, publish your first site and courts, and explore the complete Pikko partner system free for 14 days."
      metrics={[
        { label: "Your role", value: "Owner", note: "Full merchant access" },
        { label: "Subscription", value: "14 days", note: "Free trial begins today" },
        { label: "Currency", value: "PHP", note: "Philippine peso" },
        { label: "Account", value: "Ready", note: access.user.email },
      ]}
    >
      <section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold">Tell us about your business</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Use the name customers should see. A public merchant URL will be
          created from it automatically.
        </p>

        {errorMessage ? (
          <p
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <form action={createMerchantAccount} className="mt-6 space-y-5">
          <label className="block text-sm font-bold">
            Business display name
            <input
              name="displayName"
              required
              minLength={2}
              maxLength={160}
              autoComplete="organization"
              placeholder="Example Pickleball Club"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Legal business name <span className="font-normal">(optional)</span>
            <input
              name="legalName"
              maxLength={200}
              autoComplete="organization"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            Contact number <span className="font-normal">(optional)</span>
            <input
              name="contactPhone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              placeholder="+63 9xx xxx xxxx"
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--forest)] px-5 py-3.5 text-sm font-bold text-white"
          >
            Start my 14-day free trial
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Joining an existing venue instead? Ask its owner to invite your exact
          email, then <Link href="/merchant">return to the dashboard</Link>.
        </p>
      </section>
    </DashboardShell>
  );
}
