import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { adminNavigation } from "@/lib/admin/navigation";
import { sendAdminTestEmail } from "./actions";

export const metadata: Metadata = { title: "Email diagnostics" };
export const dynamic = "force-dynamic";

const feedback = {
  "provider-accepted": "Resend accepted the provider delivery simulation.",
  "admin-accepted": "Resend accepted the message to your administrator email.",
  "not-configured": "RESEND_API_KEY is not configured in this environment.",
  "invalid-mode": "The requested email test mode is invalid.",
  "provider-failed": "Resend rejected the provider simulation. Check the server logs and integration status.",
  "admin-recipient-failed":
    "Resend could not send to your administrator inbox. The testing sender only permits the Resend account owner's email until pikko.ph is verified.",
} as const;

export default async function AdminEmailTestPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    messageId?: string;
  }>;
}) {
  const [admin, query] = await Promise.all([
    requirePlatformAdmin(),
    searchParams,
  ]);
  const feedbackKey = (query.success ?? query.error) as keyof typeof feedback;
  const feedbackMessage = feedback[feedbackKey];

  return (
    <DashboardShell
      eyebrow="Platform administration · Email diagnostics"
      title="Test the server-side mailer."
      description="Run controlled Resend checks without exposing the API key or allowing arbitrary recipients."
      navigation={adminNavigation}
      metrics={[
        { label: "Provider", value: "Resend", note: "Vercel Marketplace integration" },
        { label: "Runtime", value: "Server", note: "API key is never sent to the browser" },
        { label: "Domain", value: "Paused", note: "pikko.ph verification can resume later" },
        { label: "Admin recipient", value: "1", note: admin.email },
      ]}
    >
      {feedbackMessage ? (
        <div
          role={query.error ? "alert" : "status"}
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            query.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <p>{feedbackMessage}</p>
          {query.messageId ? (
            <p className="mt-2 break-all font-mono text-xs">Message ID: {query.messageId}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--coral)]">
            Recommended first
          </p>
          <h2 className="mt-2 text-xl font-black">Provider simulation</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Sends to Resend&apos;s documented delivered test address. It verifies credentials and request acceptance without delivering to a real inbox.
          </p>
          <form action={sendAdminTestEmail} className="mt-6">
            <input type="hidden" name="mode" value="provider" />
            <button className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
              Run provider simulation
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--coral)]">
            Inbox check
          </p>
          <h2 className="mt-2 text-xl font-black">Send to administrator</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            Sends only to your authenticated platform-admin address: <strong>{admin.email}</strong>. It will work before domain verification only when this is also the Resend account email.
          </p>
          <form action={sendAdminTestEmail} className="mt-6">
            <input type="hidden" name="mode" value="admin" />
            <button className="w-full rounded-full border border-[var(--forest)] px-5 py-3 text-sm font-black text-[var(--forest)]">
              Send inbox test
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-6 text-sm leading-6 text-[var(--text-muted)]">
        <h2 className="font-black text-[var(--forest)]">Current limitation</h2>
        <p className="mt-2">
          Customer delivery remains paused until pikko.ph is connected and its Resend DKIM, SPF, and MX records are verified. The test mailer does not bypass that restriction.
        </p>
        <Link href="/admin" className="mt-4 inline-flex font-black text-[var(--forest)]">
          ← Back to platform administration
        </Link>
      </section>
    </DashboardShell>
  );
}
