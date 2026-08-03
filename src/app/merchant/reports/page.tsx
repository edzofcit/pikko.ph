import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { ReportLineChart } from "@/components/report-line-chart";
import { getDb } from "@/db";
import { courts, merchants, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantReport, normalizeReportFilters } from "@/lib/merchant/reports";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const rangeOptions = [["today", "Today"], ["yesterday", "Yesterday"], ["this_week", "This week"], ["this_month", "This month"], ["last_month", "Last month"], ["custom", "Custom"]] as const;
const bookingStatuses = ["draft", "pending_payment", "pending_verification", "confirmed", "cancelled", "expired", "completed", "no_show"];
const paymentStatuses = ["unpaid", "pending", "paid", "rejected", "failed", "partially_refunded", "refunded"];

function queryString(query: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...overrides })) if (value) params.set(key, value);
  return params.toString();
}

function statusStyle(status: string) {
  if (["paid", "confirmed", "completed"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["pending", "unpaid", "pending_payment", "pending_verification"].includes(status)) return "bg-amber-100 text-amber-900";
  if (["cancelled", "expired", "failed", "rejected", "refunded"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export default async function MerchantReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [access, query] = await Promise.all([requireMerchantPermission("view_dashboard"), searchParams]);
  const db = getDb();
  const [{ today }] = await db.select({ today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')` }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1);
  const allowedSiteIds = access.sites.map((site) => site.id);
  const filters = normalizeReportFilters(today, query, allowedSiteIds);
  const visibleSiteIds = filters.site ? [filters.site] : allowedSiteIds;
  const [courtOptions, reportSites] = await Promise.all([
    visibleSiteIds.length ? db.select({ id: courts.id, name: courts.name, siteId: courts.siteId }).from(courts).where(and(eq(courts.merchantId, access.membership.merchantId), inArray(courts.siteId, visibleSiteIds))).orderBy(asc(courts.name)) : [],
    allowedSiteIds.length ? db.select({ id: sites.id, name: sites.name, slug: sites.slug, timezone: sites.timezone }).from(sites).where(and(eq(sites.merchantId, access.membership.merchantId), inArray(sites.id, allowedSiteIds))) : [],
  ]);
  if (filters.court && !courtOptions.some((court) => court.id === filters.court)) filters.court = "";
  const report = await getMerchantReport({ merchantId: access.membership.merchantId, sites: reportSites, filters });
  const metric = query.metric === "collected" ? "collected" : "gross";
  const pageSize = 20;
  const tableRows = filters.day ? report.transactions.filter((transaction) => new Intl.DateTimeFormat("en-CA", { timeZone: transaction.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(transaction.startsAt) === filters.day) : report.transactions;
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const visibleRows = tableRows.slice((page - 1) * pageSize, page * pageSize);
  const normalizedQuery: Record<string, string | undefined> = { range: filters.range, from: filters.range === "custom" ? filters.from : undefined, to: filters.range === "custom" ? filters.to : undefined, site: filters.site || undefined, court: filters.court || undefined, paymentStatus: filters.paymentStatus || undefined, bookingStatus: filters.bookingStatus || undefined, transactionType: filters.transactionType || undefined, q: filters.q || undefined, day: filters.day || undefined, metric };
  const exportHref = `/api/merchant/reports.csv?${queryString(normalizedQuery, { page: undefined, metric: undefined })}`;
  const dateLabel = filters.from === filters.to ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${filters.from}T00:00:00Z`)) : `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.from}T00:00:00Z`))} – ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${filters.to}T00:00:00Z`))}`;

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={filters.site} activeHref="/merchant/reports" eyebrow="Financial performance" title="Reports" description={`${dateLabel} · Booking performance by scheduled play date.`} actions={<a href={exportHref} className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Export CSV ↓</a>}>
      <section className="mt-7 rounded-2xl border border-[var(--line)] bg-white p-5">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-black">Date range<select name="range" defaultValue={filters.range} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal">{rangeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-black">From<input name="from" type="date" defaultValue={filters.from} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <label className="text-xs font-black">To<input name="to" type="date" defaultValue={filters.to} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <label className="text-xs font-black">Site<select name="site" defaultValue={filters.site} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All sites</option>{access.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
          <label className="text-xs font-black">Court<select name="court" defaultValue={filters.court} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All courts</option>{courtOptions.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label>
          <label className="text-xs font-black">Payment status<select name="paymentStatus" defaultValue={filters.paymentStatus} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All statuses</option>{paymentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs font-black">Booking status<select name="bookingStatus" defaultValue={filters.bookingStatus} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All statuses</option>{bookingStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs font-black">Transaction type<select name="transactionType" defaultValue={filters.transactionType} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All types</option><option value="booking">Booking</option><option value="refund">Refund</option><option value="complimentary">Complimentary</option></select></label>
          <label className="text-xs font-black md:col-span-2">Search transactions<input name="q" defaultValue={filters.q} placeholder="Transaction, booking, customer, site, or court" className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
          <input type="hidden" name="metric" value={metric} />
          <div className="flex items-end gap-2 md:col-span-2"><button className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Apply filters</button><Link href="/merchant/reports" className="rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-black">Reset</Link></div>
        </form>
        <p className="mt-4 border-t border-[var(--line)] pt-3 text-[0.68rem] text-[var(--text-muted)]">Custom ranges are limited to 366 days. Refreshed {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(report.refreshedAt)}.</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Report summary">
        {[
          ["Gross booking value", formatPeso(report.grossBookingValueCents), "Confirmed and completed"],
          ["Collected payments", formatPeso(report.collectedPaymentsCents), "Successful less refunds"],
          ["Total bookings", String(report.totalBookings), "Current filtered result"],
          ["Court utilization", `${report.utilizationPercent}%`, `${report.utilizedHours} of ${report.availableHours} hours`],
          ["Average booking", formatPeso(report.averageBookingValueCents), "Qualifying bookings"],
          ["Pending payments", formatPeso(report.pendingPaymentsCents), "Outstanding value"],
        ].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</p><p className="mt-2 text-[0.68rem] font-semibold text-[var(--forest)]">{note}</p></article>)}
      </section>

      <div className="mt-5"><ReportLineChart points={report.daily} metric={metric} query={normalizedQuery} /></div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4"><div><h2 className="font-black">Transactions</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Booking-level financial summaries matching the selected filters.</p></div>{filters.day ? <Link href={`?${queryString(normalizedQuery, { day: undefined, page: undefined })}`} className="rounded-full bg-[var(--mint)] px-3 py-2 text-xs font-black text-[var(--forest)]">{filters.day} ×</Link> : null}</header>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[92rem] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[0.62rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Transaction ID", "Date & time", "Booking ID", "Customer", "Site / Court", "Schedule", "Payment method", "Type", "Payment", "Booking", "Gross", "Refund", "Net collected", "Actions"].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{visibleRows.map((row) => <tr key={row.bookingId}><td className="px-3 py-4 font-mono text-[0.68rem]">{row.transactionId}</td><td className="px-3 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.transactionAt)}</td><td className="px-3 py-4 font-mono text-xs font-black text-[var(--forest)]">{row.reference}</td><td className="px-3 py-4"><strong className="block">{row.customerName}</strong><small className="text-[var(--text-muted)]">{row.customerEmail}</small></td><td className="px-3 py-4"><strong className="block">{row.siteName}</strong><small>{row.courtNames.join(", ")}</small></td><td className="px-3 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: row.timezone }).format(row.startsAt)}–{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: row.timezone }).format(row.endsAt)}</td><td className="px-3 py-4 text-xs capitalize">{row.paymentMethod}</td><td className="px-3 py-4 text-xs capitalize">{row.transactionType}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.paymentStatus)}`}>{row.paymentStatus.replaceAll("_", " ")}</span></td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.bookingStatus)}`}>{row.bookingStatus.replaceAll("_", " ")}</span></td><td className="px-3 py-4 font-black">{formatPeso(row.grossCents)}</td><td className="px-3 py-4 font-black text-rose-700">{formatPeso(row.refundCents)}</td><td className="px-3 py-4 font-black text-emerald-800">{formatPeso(row.collectedCents)}</td><td className="px-3 py-4"><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">View</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[var(--line)] lg:hidden">{visibleRows.map((row) => <article key={row.bookingId} className="p-5"><div className="flex justify-between gap-3"><span className="font-mono text-xs font-black text-[var(--forest)]">{row.reference}</span><strong>{formatPeso(row.collectedCents)}</strong></div><h3 className="mt-3 font-black">{row.customerName}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{row.siteName} · {row.courtNames.join(", ")}</p><p className="mt-3 text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.startsAt)}</p><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.paymentStatus)}`}>{row.paymentStatus.replaceAll("_", " ")}</span><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.bookingStatus)}`}>{row.bookingStatus.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs"><span>Gross {formatPeso(row.grossCents)} · Refund {formatPeso(row.refundCents)}</span><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full bg-[var(--forest)] px-4 py-2 font-black text-white">View</Link></div></article>)}</div>
        {!visibleRows.length ? <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No transactions match these filters.</p> : null}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 text-xs"><span>Showing {tableRows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, tableRows.length)} of {tableRows.length}</span><div className="flex items-center gap-2"><Link aria-disabled={page === 1} href={`?${queryString(normalizedQuery, { page: String(Math.max(1, page - 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">←</Link><span className="font-black">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} href={`?${queryString(normalizedQuery, { page: String(Math.min(totalPages, page + 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">→</Link></div></footer>
      </section>
    </MerchantPreviewShell>
  );
}
