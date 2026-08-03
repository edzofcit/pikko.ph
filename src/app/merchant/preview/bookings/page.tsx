import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { getDb } from "@/db";
import { courts, merchants } from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantBookingList } from "@/lib/merchant/booking-list";
import { formatPaymentType } from "@/lib/merchant/payments";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

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

function paymentTypeStyle(type: string) {
  if (type === "online") return "bg-sky-100 text-sky-800";
  if (type === "manual") return "bg-violet-100 text-violet-800";
  if (type === "walk_in") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

export default async function MerchantBookingsPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [access, query] = await Promise.all([getMerchantAccess(), searchParams]);
  if (!access?.user) redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/bookings")}`);
  if (!access.membership) redirect("/merchant/onboarding");
  if (!access.permissions.includes("manage_bookings")) redirect("/access-denied");

  const allowedSiteIds = access.sites.map((site) => site.id);
  const selectedSiteId = allowedSiteIds.includes(query.site ?? "") ? query.site! : "";
  const visibleSiteIds = selectedSiteId ? [selectedSiteId] : allowedSiteIds;
  const db = getDb();
  const [[{ today }], courtOptions] = await Promise.all([
    db.select({ today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')` }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1),
    visibleSiteIds.length ? db.select({ id: courts.id, name: courts.name, siteId: courts.siteId }).from(courts).where(and(eq(courts.merchantId, access.membership.merchantId), inArray(courts.siteId, visibleSiteIds))).orderBy(asc(courts.name)) : [],
  ]);
  const rows = await getMerchantBookingList({ merchantId: access.membership.merchantId, siteIds: allowedSiteIds, filters: { ...query, site: selectedSiteId }, today });
  const pageSize = [10, 20, 50].includes(Number(query.perPage)) ? Number(query.perPage) : 20;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const paidRevenue = rows.filter((row) => row.paymentStatus === "paid").reduce((sum, row) => sum + row.totalCents, 0);
  const pendingCount = rows.filter((row) => row.paymentStatus === "pending" || row.paymentStatus === "unpaid").length;
  const exportHref = `/api/merchant/preview/bookings.csv?${queryString(query, { site: selectedSiteId || undefined, page: undefined, perPage: undefined })}`;

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={selectedSiteId} activeHref="/merchant/bookings" eyebrow="Merchant dashboard" title="Bookings" description="Search, filter, and manage reservations across your assigned sites." actions={<><a href={exportHref} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black">Export CSV ↓</a><Link href="/merchant/bookings/new" className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">+ Create booking</Link></>}>
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[["Bookings", String(rows.length), "Current filtered result", "bg-[var(--forest)] text-white"], ["Booking sales", formatPeso(paidRevenue), "Paid reservations", "bg-white"], ["Pending payments", String(pendingCount), "Requires follow-up", "bg-white"], ["Scope", selectedSiteId ? access.sites.find((site) => site.id === selectedSiteId)?.name ?? "Site" : "All sites", `${visibleSiteIds.length} visible site${visibleSiteIds.length === 1 ? "" : "s"}`, "bg-white"]].map(([label, value, note, style]) => <article key={label} className={`rounded-3xl border border-[var(--line)] p-5 ${style}`}><p className={`text-xs font-bold ${label === "Bookings" ? "text-white/70" : "text-[var(--text-muted)]"}`}>{label}</p><p className="mt-3 text-2xl font-black">{value}</p><p className={`mt-2 text-xs ${label === "Bookings" ? "text-[var(--lime)]" : "text-[var(--forest)]"}`}>{note}</p></article>)}
      </section>

      <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] p-4">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--cream)] p-1">
            {["all", "upcoming", "today", "past", "cancelled"].map((tab) => <Link key={tab} href={`?${queryString(query, { tab: tab === "all" ? undefined : tab, page: undefined })}`} className={`shrink-0 rounded-lg px-4 py-2 text-xs font-black capitalize ${((query.tab ?? "all") === tab) ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)]"}`}>{tab}</Link>)}
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="tab" value={query.tab ?? ""} />
            <label className="text-xs font-black">Search<input name="q" defaultValue={query.q ?? ""} placeholder="ID, customer, email or phone" className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Site<select name="site" defaultValue={selectedSiteId} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All sites</option>{access.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <label className="text-xs font-black">Court<select name="court" defaultValue={query.court ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All courts</option>{courtOptions.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label>
            <label className="text-xs font-black">Booking status<select name="bookingStatus" defaultValue={query.bookingStatus ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All statuses</option>{bookingStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
            <label className="text-xs font-black">Payment status<select name="paymentStatus" defaultValue={query.paymentStatus ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All statuses</option>{paymentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
            <label className="text-xs font-black">Payment type<select name="paymentType" defaultValue={query.paymentType ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All types</option><option value="online">Online</option><option value="manual">Manual</option><option value="walk_in">Walk-in</option></select></label>
            <label className="text-xs font-black">From<input name="from" type="date" defaultValue={query.from ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">To<input name="to" type="date" defaultValue={query.to ?? ""} className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <div className="flex items-end gap-2"><button className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Apply filters</button><Link href={selectedSiteId ? `?site=${selectedSiteId}` : "/merchant/bookings"} className="rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-black">Reset</Link></div>
          </form>
        </div>

        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[76rem] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Booking ID", "Customer", "Site / Court", "Schedule", "Payment", "Booking status", "Amount", "Actions"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{visibleRows.map((booking) => <tr key={booking.id} className="transition hover:bg-[var(--cream)]/50"><td className="px-4 py-4 font-mono text-xs font-black text-[var(--forest)]">{booking.reference}</td><td className="px-4 py-4"><strong className="block">{booking.customerName ?? "Guest"}</strong><small className="text-[var(--text-muted)]">{booking.customerEmail ?? booking.customerMobileNumber}</small></td><td className="px-4 py-4"><strong className="block">{booking.siteName}</strong><small>{booking.courtName} · {booking.indoor ? "Indoor" : "Outdoor"}</small></td><td className="px-4 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(booking.startsAt)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black ${paymentTypeStyle(booking.paymentType)}`}>{formatPaymentType(booking.paymentType)}</span><span className={`ml-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-black capitalize ${statusStyle(booking.paymentStatus)}`}>{booking.paymentStatus.replaceAll("_", " ")}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusStyle(booking.status)}`}>{booking.status.replaceAll("_", " ")}</span></td><td className="px-4 py-4 font-black">{formatPeso(booking.totalCents)}</td><td className="px-4 py-4"><Link href={`/merchant/bookings/${booking.id}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black transition hover:-translate-y-0.5 hover:bg-[var(--cream)]">View</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[var(--line)] md:hidden">{visibleRows.map((booking) => <article key={booking.id} className="p-5"><div className="flex justify-between gap-3"><span className="font-mono text-xs font-black text-[var(--forest)]">{booking.reference}</span><strong>{formatPeso(booking.totalCents)}</strong></div><h2 className="mt-3 font-black">{booking.customerName ?? "Guest"}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{booking.siteName} · {booking.courtName}</p><p className="mt-3 text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(booking.startsAt)}</p><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black ${paymentTypeStyle(booking.paymentType)}`}>{formatPaymentType(booking.paymentType)}</span><span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black capitalize ${statusStyle(booking.paymentStatus)}`}>{booking.paymentStatus.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="text-xs font-bold capitalize">{booking.status.replaceAll("_", " ")}</span><Link href={`/merchant/bookings/${booking.id}`} className="rounded-full bg-[var(--forest)] px-4 py-2 text-xs font-black text-white">View</Link></div></article>)}</div>
        {!visibleRows.length ? <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No bookings match these filters.</p> : null}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 text-xs"><span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} of {rows.length}</span><div className="flex items-center gap-2"><Link aria-disabled={page === 1} href={`?${queryString(query, { page: String(Math.max(1, page - 1)), perPage: String(pageSize) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">←</Link><span className="font-black">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} href={`?${queryString(query, { page: String(Math.min(totalPages, page + 1)), perPage: String(pageSize) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">→</Link></div></footer>
      </section>
    </MerchantPreviewShell>
  );
}
