import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { PaymentSalesChart } from "@/components/payment-sales-chart";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { formatPaymentType, getMerchantPaymentDashboard, normalizeMerchantPaymentFilters } from "@/lib/merchant/payments";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const rangeOptions = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["custom", "Date range"]] as const;
const paymentStatuses = ["pending", "paid", "rejected", "failed", "partially_refunded", "refunded"];

function queryString(query: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...overrides })) if (value) params.set(key, value);
  return params.toString();
}

function statusStyle(status: string) {
  if (status === "paid") return "bg-emerald-100 text-emerald-800";
  if (["pending", "unpaid"].includes(status)) return "bg-amber-100 text-amber-900";
  if (["failed", "rejected", "refunded"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function typeStyle(type: string) {
  if (type === "online") return "bg-sky-100 text-sky-800";
  if (type === "manual") return "bg-violet-100 text-violet-800";
  if (type === "walk_in") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

function formatMethod(method: string) {
  const labels: Record<string, string> = {
    maya_qrph: "Maya QRPh",
    manual_bank_transfer: "Bank transfer",
    manual_ewallet: "E-wallet",
    cash: "Cash",
    complimentary: "Complimentary",
  };
  return labels[method] ?? method.replaceAll("_", " ");
}

export default async function MerchantPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [access, query] = await Promise.all([requireMerchantPermission("verify_payments"), searchParams]);
  const [{ today }] = await getDb().select({ today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')` }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1);
  const allowedSiteIds = access.sites.map((site) => site.id);
  const filters = normalizeMerchantPaymentFilters(today, query, allowedSiteIds);
  const dashboard = await getMerchantPaymentDashboard({ merchantId: access.membership.merchantId, siteIds: allowedSiteIds, filters });
  const pageSize = [10, 20, 50].includes(Number(query.perPage)) ? Number(query.perPage) : 20;
  const totalPages = Math.max(1, Math.ceil(dashboard.transactions.length / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const visibleRows = dashboard.transactions.slice((page - 1) * pageSize, page * pageSize);
  const normalizedQuery: Record<string, string | undefined> = {
    range: filters.range,
    from: filters.range === "custom" ? filters.from : undefined,
    to: filters.range === "custom" ? filters.to : undefined,
    site: filters.site || undefined,
    paymentType: filters.paymentType || undefined,
    status: filters.status || undefined,
    q: filters.q || undefined,
    perPage: String(pageSize),
  };
  const dateLabel = filters.from === filters.to
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${filters.from}T00:00:00Z`))
    : `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.from}T00:00:00Z`))} – ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.to}T00:00:00Z`))}`;

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={filters.site} activeHref="/merchant/payments" eyebrow="Payment operations" title="Payments" description={`${dateLabel} · Track successful sales and every payment attempt across your assigned sites.`}>
      <section className="mt-7 rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-5">
        <nav aria-label="Payment period" className="flex gap-1 overflow-x-auto rounded-2xl bg-[var(--cream)] p-1">
          {rangeOptions.map(([value, label]) => <Link key={value} href={`?${queryString(normalizedQuery, { range: value, from: undefined, to: undefined, page: undefined })}`} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition ${filters.range === value ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)] hover:bg-white/70"}`}>{label}</Link>)}
        </nav>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-black">Period<select name="range" defaultValue={filters.range} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal">{rangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-black">From<input name="from" type="date" defaultValue={filters.from} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <label className="text-xs font-black">To<input name="to" type="date" defaultValue={filters.to} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <label className="text-xs font-black">Site<select name="site" defaultValue={filters.site} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All sites</option>{access.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="text-xs font-black">Payment type<select name="paymentType" defaultValue={filters.paymentType} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All types</option><option value="online">Online</option><option value="manual">Manual</option><option value="walk_in">Walk-in</option></select></label>
          <label className="text-xs font-black">Payment status<select name="status" defaultValue={filters.status} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All statuses</option>{paymentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs font-black md:col-span-2">Search transactions<input name="q" defaultValue={filters.q} placeholder="Payment ID, booking, customer, or site" className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4"><button className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#0d5b3b]">Apply filters</button><Link href="/merchant/payments" className="rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5 hover:bg-[var(--cream)]">Reset</Link></div>
        </form>
        <p className="mt-4 border-t border-[var(--line)] pt-3 text-[0.68rem] text-[var(--text-muted)]">Sales cards and chart count successful paid transactions by payment completion date. Custom ranges are limited to 366 days.</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Payment sales summary">
        {[
          ["Total booking sales", formatPeso(dashboard.totalBookingSalesCents), "All successful payment types", "bg-[var(--forest)] text-white"],
          ["Online payments", formatPeso(dashboard.onlinePaymentsCents), "Maya QRPh", "bg-white"],
          ["Manual payments", formatPeso(dashboard.manualPaymentsCents), "Merchant-verified transfers", "bg-white"],
          ["Walk-in payments", formatPeso(dashboard.walkInPaymentsCents), "Cash collected at venue", "bg-white"],
        ].map(([label, value, note, style]) => <article key={label} className={`rounded-3xl border border-[var(--line)] p-4 sm:p-5 ${style}`}><p className={`text-xs font-bold ${label === "Total booking sales" ? "text-white/70" : "text-[var(--text-muted)]"}`}>{label}</p><p className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{value}</p><p className={`mt-2 text-[0.68rem] font-semibold ${label === "Total booking sales" ? "text-[var(--lime)]" : "text-[var(--forest)]"}`}>{note}</p></article>)}
      </section>

      <div className="mt-5"><PaymentSalesChart points={dashboard.daily} /></div>

      <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div><h2 className="font-black">Payment transactions</h2><p className="mt-1 text-xs text-[var(--text-muted)]">All payment attempts matching the selected filters.</p></div><span className="rounded-full bg-[var(--cream)] px-3 py-2 text-xs font-black">{dashboard.transactions.length} transaction{dashboard.transactions.length === 1 ? "" : "s"}</span></header>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[82rem] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[0.62rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Payment ID", "Transaction date", "Booking", "Customer", "Site / Court", "Payment type", "Method", "Status", "Amount", "Action"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{visibleRows.map((row) => <tr key={row.id} className="transition hover:bg-[var(--cream)]/50"><td className="px-4 py-4"><span className="block font-mono text-[0.68rem] font-black text-[var(--forest)]">{row.requestReference}</span>{row.providerReference ? <small className="mt-1 block max-w-44 truncate text-[var(--text-muted)]">{row.providerReference}</small> : null}</td><td className="px-4 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(row.transactionAt)}</td><td className="px-4 py-4 font-mono text-xs font-black">{row.bookingReference}</td><td className="px-4 py-4"><strong className="block">{row.customerName ?? "Guest"}</strong><small className="text-[var(--text-muted)]">{row.customerEmail ?? "No email"}</small></td><td className="px-4 py-4"><strong className="block">{row.siteName}</strong><small className="text-[var(--text-muted)]">{row.courtNames.join(", ") || "Court unavailable"}</small></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black ${typeStyle(row.paymentType)}`}>{formatPaymentType(row.paymentType)}</span></td><td className="px-4 py-4 text-xs font-semibold">{formatMethod(row.method)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.status)}`}>{row.status.replaceAll("_", " ")}</span></td><td className="px-4 py-4 font-black">{formatPeso(row.amountCents)}</td><td className="px-4 py-4"><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 hover:bg-[var(--cream)]">View booking</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[var(--line)] lg:hidden">{visibleRows.map((row) => <article key={row.id} className="p-5"><div className="flex justify-between gap-3"><span className="font-mono text-[0.68rem] font-black text-[var(--forest)]">{row.requestReference}</span><strong>{formatPeso(row.amountCents)}</strong></div><h3 className="mt-3 font-black">{row.customerName ?? "Guest"}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{row.siteName} · {row.courtNames.join(", ") || "Court unavailable"}</p><p className="mt-3 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(row.transactionAt)}</p><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black ${typeStyle(row.paymentType)}`}>{formatPaymentType(row.paymentType)}</span><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.status)}`}>{row.status.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs font-semibold">{formatMethod(row.method)}</span><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full bg-[var(--forest)] px-4 py-2 text-xs font-black text-white">View</Link></div></article>)}</div>
        {!visibleRows.length ? <p className="px-5 py-14 text-center text-sm text-[var(--text-muted)]">No payment transactions match these filters.</p> : null}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 text-xs"><span>Showing {dashboard.transactions.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, dashboard.transactions.length)} of {dashboard.transactions.length}</span><div className="flex items-center gap-2"><Link aria-disabled={page === 1} href={`?${queryString(normalizedQuery, { page: String(Math.max(1, page - 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">←</Link><span className="font-black">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} href={`?${queryString(normalizedQuery, { page: String(Math.min(totalPages, page + 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">→</Link></div></footer>
      </section>
    </MerchantPreviewShell>
  );
}
