import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantAccess } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Merchant dashboard" };

const bookings = [
  ["PK-1048", "Court 01", "6:00–8:00 PM", "Paid", "₱1,500"],
  ["PK-1049", "Court 03", "7:00–8:00 PM", "Verify payment", "₱700"],
  ["PK-1050", "Center Court", "8:00–9:00 PM", "Walk-in", "₱650"],
];

export const dynamic = "force-dynamic";

export default async function MerchantPage() {
  const access = await getMerchantAccess();

  if (!access?.user) {
    return null;
  }

  if (!access.membership) {
    redirect("/merchant/onboarding");
  }

  const role = formatMerchantRole(access.membership.role);
  const siteNames = access.sites.map((site) => site.name).join(", ");
  const canManageStaff = access.permissions.includes("manage_staff");

  return (
    <DashboardShell
      eyebrow={`Merchant workspace · ${access.membership.merchantName}`}
      title={`Welcome back, ${access.user.fullName}.`}
      description={`${role} access${siteNames ? ` for ${siteNames}` : ""}. Your role controls every dashboard page and server action.`}
      navigation={[
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/venues", label: "Sites & courts" }]
          : []),
        ...(canManageStaff ? [{ href: "/merchant/team", label: "Team" }] : []),
      ]}
      metrics={[
        { label: "Today’s bookings", value: "18", note: "+4 versus last Saturday" },
        { label: "Collected today", value: "₱12.8k", note: "14 paid bookings" },
        { label: "Court utilization", value: "76%", note: "5:00–10:00 PM peak" },
        { label: "Needs attention", value: "3", note: "Manual payments to verify" },
      ]}
    >
      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="font-bold">Upcoming bookings</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Saturday, August 8 · Assigned sites</p>
          </div>
          <button type="button" className="text-sm font-bold text-[var(--forest)]">View calendar</button>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {bookings.map(([reference, court, time, state, amount]) => (
            <div key={reference} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[0.8fr_1fr_1.2fr_1fr_0.6fr] sm:items-center">
              <span className="font-mono text-xs font-bold">{reference}</span>
              <span className="font-semibold">{court}</span>
              <span className="text-[var(--text-muted)]">{time}</span>
              <span className="w-fit rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]">{state}</span>
              <span className="font-bold sm:text-right">{amount}</span>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
