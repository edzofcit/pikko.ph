import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import {
  bookings,
  courts,
  manualPaymentProofs,
  merchants,
  sites,
} from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { adminNavigation } from "@/lib/admin/navigation";
import { formatPeso } from "@/lib/money";
import { updateMerchantCommercialSettings } from "./actions";

export const metadata: Metadata = { title: "Platform administration" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [user, query] = await Promise.all([
    requirePlatformAdmin(),
    searchParams,
  ]);
  const db = getDb();
  const [merchantRows, recentBookings] = await Promise.all([
    db
      .select({
        id: merchants.id,
        displayName: merchants.displayName,
        slug: merchants.slug,
        contactEmail: merchants.contactEmail,
        status: merchants.status,
        subscriptionStatus: merchants.subscriptionStatus,
        monthlyCourtPriceCents: merchants.monthlyCourtPriceCents,
        gatewayFeeBasisPoints: merchants.gatewayFeeBasisPoints,
        createdAt: merchants.createdAt,
        siteCount: sql<number>`(
          select count(*)::int from ${sites}
          where ${sites.merchantId} = ${merchants.id}
        )`.mapWith(Number),
        courtCount: sql<number>`(
          select count(*)::int from ${courts}
          where ${courts.merchantId} = ${merchants.id}
        )`.mapWith(Number),
        bookingCount: sql<number>`(
          select count(*)::int from ${bookings}
          where ${bookings.merchantId} = ${merchants.id}
        )`.mapWith(Number),
        collectedCents: sql<number>`coalesce((
          select sum(${bookings.totalCents})::bigint from ${bookings}
          where ${bookings.merchantId} = ${merchants.id}
            and ${bookings.paymentStatus} = 'paid'
        ), 0)`.mapWith(Number),
        pendingProofCount: sql<number>`(
          select count(*)::int from ${manualPaymentProofs}
          where ${manualPaymentProofs.merchantId} = ${merchants.id}
            and ${manualPaymentProofs.status} = 'submitted'
        )`.mapWith(Number),
      })
      .from(merchants)
      .orderBy(desc(merchants.createdAt)),
    db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        customerName: bookings.customerName,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        totalCents: bookings.totalCents,
        createdAt: bookings.createdAt,
        merchantName: merchants.displayName,
        siteName: sites.name,
      })
      .from(bookings)
      .innerJoin(merchants, eq(merchants.id, bookings.merchantId))
      .innerJoin(sites, eq(sites.id, bookings.siteId))
      .orderBy(desc(bookings.createdAt))
      .limit(12),
  ]);

  const activeMerchants = merchantRows.filter(
    (merchant) => merchant.status === "active",
  ).length;
  const billableCourts = merchantRows
    .filter((merchant) => merchant.subscriptionStatus !== "cancelled")
    .reduce((total, merchant) => total + merchant.courtCount, 0);
  const collectedCents = merchantRows.reduce(
    (total, merchant) => total + merchant.collectedCents,
    0,
  );
  const pendingProofs = merchantRows.reduce(
    (total, merchant) => total + merchant.pendingProofCount,
    0,
  );

  return (
    <DashboardShell
      eyebrow="Pikko.ph platform administration"
      title={`Marketplace overview, ${user.fullName}.`}
      description="Live platform operations across merchants, subscriptions, courts, bookings, payment verification, and configurable commercial terms."
      navigation={adminNavigation}
      metrics={[
        { label: "Active merchants", value: String(activeMerchants), note: `${merchantRows.length} total merchant accounts` },
        { label: "Billable courts", value: String(billableCourts), note: "Excludes cancelled subscriptions" },
        { label: "Collected booking value", value: formatPeso(collectedCents), note: "All paid bookings" },
        { label: "Payment proofs", value: String(pendingProofs), note: "Awaiting merchant verification" },
      ]}
    >
      {query.success || query.error ? (
        <p
          role={query.error ? "alert" : "status"}
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            query.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {query.error ?? query.success}
        </p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-bold">Merchant accounts</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Configure access status, subscription state, monthly court price, and gateway percentage per merchant.
          </p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {merchantRows.map((merchant) => (
            <article key={merchant.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{merchant.displayName}</h3>
                    <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black uppercase text-[var(--forest)]">
                      {merchant.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {merchant.contactEmail ?? `/${merchant.slug}`} · Joined {formatDateTime(merchant.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/${merchant.slug}`}
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--forest)]"
                >
                  View public page
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Sites", String(merchant.siteCount)],
                  ["Courts", String(merchant.courtCount)],
                  ["Bookings", String(merchant.bookingCount)],
                  ["Collected", formatPeso(merchant.collectedCents)],
                  ["Proofs pending", String(merchant.pendingProofCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[var(--paper)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">{label}</p>
                    <p className="mt-1 font-black">{value}</p>
                  </div>
                ))}
              </div>

              <form
                action={updateMerchantCommercialSettings}
                className="mt-5 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
              >
                <input type="hidden" name="merchantId" value={merchant.id} />
                <label className="text-xs font-bold">
                  Merchant status
                  <select name="status" defaultValue={merchant.status} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="onboarding">Onboarding</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Subscription
                  <select name="subscriptionStatus" defaultValue={merchant.subscriptionStatus} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal">
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Per court / month (PHP)
                  <input name="monthlyCourtPrice" type="number" min="0" max="1000000" step="0.01" defaultValue={(merchant.monthlyCourtPriceCents / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-bold">
                  Gateway fee (%)
                  <input name="gatewayFeePercentage" type="number" min="0" max="100" step="0.01" defaultValue={(merchant.gatewayFeeBasisPoints / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal" />
                </label>
                <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
                  Save settings
                </button>
              </form>
              <p className="mt-3 text-right text-xs text-[var(--text-muted)]">
                Estimated court subscription: {formatPeso(merchant.courtCount * merchant.monthlyCourtPriceCents)}/month
              </p>
            </article>
          ))}
          {!merchantRows.length ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No merchant accounts have been created yet.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-bold">Recent platform bookings</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Latest activity across every merchant and site</p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {recentBookings.map((booking) => (
            <div key={booking.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[0.8fr_1.2fr_1fr_1fr_0.7fr] sm:items-center">
              <span className="font-mono text-xs font-black">{booking.reference}</span>
              <span className="font-bold">{booking.merchantName} · {booking.siteName}</span>
              <span className="text-[var(--text-muted)]">{booking.customerName ?? "Guest"}</span>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-black">{booking.status.replaceAll("_", " ")}</span>
                <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black">{booking.paymentStatus.replaceAll("_", " ")}</span>
              </div>
              <span className="font-black sm:text-right">{formatPeso(booking.totalCents)}</span>
            </div>
          ))}
          {!recentBookings.length ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No bookings yet.</p>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
