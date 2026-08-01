import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { requirePlatformAdmin } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Platform administration" };

const merchants = [
  ["The Kitchen", "2 sites · 7 courts", "Active", "₱10.2k"],
  ["Rally Club", "1 site · 4 courts", "Active", "₱5.8k"],
  ["Paddle Yard", "3 sites · 9 courts", "Review", "₱12.6k"],
];

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requirePlatformAdmin();

  return (
    <DashboardShell
      eyebrow="Pikko.ph platform administration"
      title={`Marketplace overview, ${user.fullName}.`}
      description="Authenticated platform-administrator access for merchants, subscriptions, transaction fees, support, and reconciliation."
      metrics={[
        { label: "Active merchants", value: "24", note: "3 onboarding this month" },
        { label: "Billable courts", value: "86", note: "+7 month over month" },
        { label: "Booking value", value: "₱1.2m", note: "Current month gross value" },
        { label: "Reconciliation", value: "5", note: "Transactions need review" },
      ]}
    >
      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-bold">Merchant accounts</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Subscription and platform-fee snapshot</p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {merchants.map(([merchant, footprint, state, billing]) => (
            <div key={merchant} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1.2fr_1fr_0.7fr_0.7fr] sm:items-center">
              <span className="font-bold">{merchant}</span>
              <span className="text-[var(--text-muted)]">{footprint}</span>
              <span className="w-fit rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-bold">{state}</span>
              <span className="font-bold sm:text-right">{billing}/mo</span>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
