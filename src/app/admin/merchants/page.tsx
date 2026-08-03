import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { getDb } from "@/db";
import { bookings, courts, merchants, platformSettings, sites } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";
import {
  manuallyOnboardMerchant,
  updateMerchantCommercialSettings,
} from "../actions";

export const metadata: Metadata = { title: "Manage merchants" };
export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
  }).format(value);
}

function trialNote(status: string, trialEndsAt: Date) {
  if (status !== "trialing") return status.replaceAll("_", " ");
  const days = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000));
  return `${days} trial ${days === 1 ? "day" : "days"} remaining`;
}

export default async function AdminMerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [admin, query] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const db = getDb();
  const [merchantBaseRows, defaultRows, siteCountRows, courtCountRows, bookingCountRows] = await Promise.all([db
    .select({
      id: merchants.id,
      displayName: merchants.displayName,
      legalName: merchants.legalName,
      slug: merchants.slug,
      contactEmail: merchants.contactEmail,
      status: merchants.status,
      subscriptionStatus: merchants.subscriptionStatus,
      trialEndsAt: merchants.trialEndsAt,
      monthlyCourtPriceCents: merchants.monthlyCourtPriceCents,
      gatewayFeeBasisPoints: merchants.gatewayFeeBasisPoints,
      onlinePaymentsAllowed: merchants.onlinePaymentsAllowed,
    })
    .from(merchants)
    .orderBy(desc(merchants.createdAt)),
    db.select().from(platformSettings).limit(1),
    db.select({ merchantId: sites.merchantId, count: sql<number>`count(*)::int`.mapWith(Number) }).from(sites).groupBy(sites.merchantId),
    db.select({ merchantId: courts.merchantId, count: sql<number>`count(*)::int`.mapWith(Number) }).from(courts).groupBy(courts.merchantId),
    db.select({ merchantId: bookings.merchantId, count: sql<number>`count(*)::int`.mapWith(Number) }).from(bookings).groupBy(bookings.merchantId),
  ]);
  const siteCounts = new Map(siteCountRows.map((row) => [row.merchantId, row.count]));
  const courtCounts = new Map(courtCountRows.map((row) => [row.merchantId, row.count]));
  const bookingCounts = new Map(bookingCountRows.map((row) => [row.merchantId, row.count]));
  const merchantRows = merchantBaseRows.map((merchant) => ({
    ...merchant,
    siteCount: siteCounts.get(merchant.id) ?? 0,
    courtCount: courtCounts.get(merchant.id) ?? 0,
    bookingCount: bookingCounts.get(merchant.id) ?? 0,
  }));
  const trialRows = merchantRows.filter(
    (merchant) => merchant.subscriptionStatus === "trialing",
  );
  const defaults = defaultRows[0];

  return (
    <AdminShell admin={admin} activeHref="/admin/merchants"
      eyebrow="Platform administration"
      title="Merchant management"
      description="Onboard operators, review their sites and courts, and configure subscription and gateway rates."
      metrics={[
        { label: "Merchants", value: String(merchantRows.length), note: "All tenant accounts" },
        { label: "Trialing", value: String(merchantRows.filter((row) => row.subscriptionStatus === "trialing").length), note: "14-day trial" },
        { label: "Paid", value: String(merchantRows.filter((row) => row.subscriptionStatus === "active").length), note: "Active subscriptions" },
        { label: "Default rate", value: formatPeso(defaults?.defaultMonthlyCourtPriceCents ?? 59900), note: "Per active court / month" },
      ]}
    >
      {query.success || query.error ? (
        <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {query.error ?? query.success}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">Manual onboarding</p>
        <h2 className="mt-2 text-xl font-black">Create a merchant and owner login</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Pikko creates a 14-day trial and emails a high-entropy temporary password to the owner.</p>
        <form action={manuallyOnboardMerchant} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-black">Merchant display name<input name="displayName" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-black">Legal name <span className="font-normal">(optional)</span><input name="legalName" maxLength={200} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-black">Owner full name<input name="ownerName" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-black">Owner email<input name="ownerEmail" type="email" required maxLength={320} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" /></label>
          <label className="text-xs font-black">Contact phone <span className="font-normal">(optional)</span><input name="contactPhone" type="tel" maxLength={40} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" /></label>
          <div className="flex items-end"><button className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Create merchant & email access</button></div>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--forest)]/15 bg-[var(--forest)] text-white shadow-[0_18px_55px_rgb(23_60_42_/_12%)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-5 py-6 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--lime)]">Trial pipeline</p>
            <h2 className="mt-2 text-2xl font-black">Currently on a 14-day trial</h2>
            <p className="mt-2 text-sm text-white/65">Prioritize onboarding and review activity before each trial expires.</p>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{trialRows.length} active</span>
        </div>
        {trialRows.length ? (
          <div className="divide-y divide-white/10">
            {trialRows.map((merchant) => (
              <article key={merchant.id} className="grid gap-4 px-5 py-5 transition hover:bg-white/5 sm:px-6 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto] lg:items-center">
                <div>
                  <h3 className="font-black">{merchant.displayName}</h3>
                  <p className="mt-1 text-xs text-white/60">{merchant.contactEmail ?? `/${merchant.slug}`}</p>
                </div>
                <div><p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/45">Time remaining</p><p className="mt-1 text-sm font-black text-[var(--lime)]">{trialNote(merchant.subscriptionStatus, merchant.trialEndsAt)}</p></div>
                <div><p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/45">Setup activity</p><p className="mt-1 text-sm font-bold">{merchant.siteCount} sites · {merchant.courtCount} courts · {merchant.bookingCount} bookings</p></div>
                <Link href={`/admin/merchants/${merchant.id}`} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--lime)] px-5 text-xs font-black text-[var(--forest)] transition hover:-translate-y-0.5 hover:bg-white motion-reduce:transform-none">Review trial</Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-white/60">No merchants are currently in the trial period.</p>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">Merchant directory</p>
          <h2 className="mt-2 text-2xl font-black">All merchant accounts</h2>
        </div>
        {merchantRows.map((merchant) => (
          <article key={merchant.id} className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black">{merchant.displayName}</h2>
                  <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black uppercase text-[var(--forest)]">{merchant.status}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{merchant.contactEmail ?? `/${merchant.slug}`} · {trialNote(merchant.subscriptionStatus, merchant.trialEndsAt)} · trial ends {formatDate(merchant.trialEndsAt)}</p>
              </div>
              <Link href={`/admin/merchants/${merchant.id}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--forest)]">View sites & courts</Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--paper)] p-3"><p className="text-xs text-[var(--text-muted)]">Sites</p><p className="mt-1 font-black">{merchant.siteCount}</p></div>
              <div className="rounded-xl bg-[var(--paper)] p-3"><p className="text-xs text-[var(--text-muted)]">Courts</p><p className="mt-1 font-black">{merchant.courtCount}</p></div>
              <div className="rounded-xl bg-[var(--paper)] p-3"><p className="text-xs text-[var(--text-muted)]">Bookings</p><p className="mt-1 font-black">{merchant.bookingCount}</p></div>
            </div>

            <form action={updateMerchantCommercialSettings} className="mt-4 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
              <input type="hidden" name="merchantId" value={merchant.id} />
              <input type="hidden" name="returnTo" value="/admin/merchants" />
              <label className="text-xs font-bold">Merchant status<select name="status" defaultValue={merchant.status} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal"><option value="onboarding">Onboarding</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select></label>
              <label className="text-xs font-bold">Subscription<select name="subscriptionStatus" defaultValue={merchant.subscriptionStatus} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal"><option value="trialing">Trialing</option><option value="active">Paid / active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option></select></label>
              <label className="text-xs font-bold">Per court / month (PHP)<input name="monthlyCourtPrice" type="number" min="0" max="1000000" step="0.01" defaultValue={(merchant.monthlyCourtPriceCents / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal" /></label>
              <label className="text-xs font-bold">Gateway fee (%)<input name="gatewayFeePercentage" type="number" min="0" max="100" step="0.01" defaultValue={(merchant.gatewayFeeBasisPoints / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-normal" /></label>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-xs font-bold"><input name="onlinePaymentsAllowed" type="checkbox" defaultChecked={merchant.onlinePaymentsAllowed} /> Allow online payments</label>
              <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Save settings</button>
            </form>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
