import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantCustomers } from "@/lib/merchant/customers";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Customer history" };
export const dynamic = "force-dynamic";
const CUSTOMER_KEY = /^[0-9a-f]{24}$/;

function statusStyle(status: string) {
  if (["paid", "confirmed", "completed"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["pending", "unpaid", "pending_payment", "pending_verification"].includes(status)) return "bg-amber-100 text-amber-900";
  if (["cancelled", "expired", "failed", "rejected", "refunded"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = { customer_web: "Customer web", merchant_walk_in: "Walk-in", merchant_phone: "Phone", merchant_complimentary: "Complimentary" };
  return labels[source] ?? source.replaceAll("_", " ");
}

export default async function MerchantCustomerHistoryPage({ params, searchParams }: { params: Promise<{ customerKey: string }>; searchParams: Promise<{ site?: string; page?: string }> }) {
  const [access, route, query] = await Promise.all([requireMerchantPermission("manage_bookings"), params, searchParams]);
  if (!CUSTOMER_KEY.test(route.customerKey)) notFound();
  const selectedSiteId = access.sites.some((site) => site.id === query.site) ? query.site! : "";
  const customers = await getMerchantCustomers({ merchantId: access.membership.merchantId, siteIds: access.sites.map((site) => site.id), selectedSiteId });
  const customer = customers.find((candidate) => candidate.key === route.customerKey);
  if (!customer) notFound();
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(customer.transactions.length / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const transactions = customer.transactions.slice((page - 1) * pageSize, page * pageSize);
  const listHref = `/merchant/customers${selectedSiteId ? `?site=${selectedSiteId}` : ""}`;

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={selectedSiteId} activeHref="/merchant/customers" eyebrow="Customer profile" title={customer.name} description="Booking and payment history across the sites available to your account." actions={<Link href={listHref} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black">← All customers</Link>}>
      <section className="mt-7 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <article className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--mint)] text-2xl font-black text-[var(--forest)]">{customer.name.slice(0, 1).toUpperCase()}</div>
          <h2 className="mt-5 text-xl font-black">Contact details</h2>
          <dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs font-bold text-[var(--text-muted)]">Email</dt><dd className="mt-1 break-all font-semibold">{customer.email || "Not provided"}</dd></div><div><dt className="text-xs font-bold text-[var(--text-muted)]">Phone</dt><dd className="mt-1 font-semibold">{customer.phone || "Not provided"}</dd></div><div><dt className="text-xs font-bold text-[var(--text-muted)]">Sites visited</dt><dd className="mt-1 font-semibold">{customer.siteNames.join(", ")}</dd></div><div><dt className="text-xs font-bold text-[var(--text-muted)]">Customer since</dt><dd className="mt-1 font-semibold">{new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" }).format(customer.firstBookingAt)}</dd></div></dl>
        </article>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Customer totals">{[["Bookings", String(customer.bookingCount), "All recorded bookings"], ["Gross booked", formatPeso(customer.grossCents), "Excludes cancelled"], ["Net collected", formatPeso(customer.collectedCents), "Successful less refunds"], ["Refunded", formatPeso(customer.refundCents), customer.nextBookingAt ? `Next: ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(customer.nextBookingAt)}` : "No upcoming booking"]].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</p><p className="mt-2 text-[0.68rem] font-semibold text-[var(--forest)]">{note}</p></article>)}</section>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <header className="border-b border-[var(--line)] px-5 py-4"><h2 className="font-black">Transactions</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Bookings, payments, and refunds associated with this customer.</p></header>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[78rem] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[0.62rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Transaction", "Booking", "Site / Court", "Schedule", "Source", "Payment method", "Payment", "Booking", "Gross", "Refund", "Net", "Actions"].map((label) => <th key={label} className="px-3 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{transactions.map((row) => <tr key={row.bookingId}><td className="px-3 py-4"><span className="block font-mono text-[0.68rem]">{row.transactionId}</span><small className="text-[var(--text-muted)]">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.transactionAt)}</small></td><td className="px-3 py-4 font-mono text-xs font-black text-[var(--forest)]">{row.reference}</td><td className="px-3 py-4"><strong className="block">{row.siteName}</strong><small>{row.courtNames.join(", ")}</small></td><td className="px-3 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.startsAt)}</td><td className="px-3 py-4 text-xs">{sourceLabel(row.source)}</td><td className="px-3 py-4 text-xs">{row.paymentMethod}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.paymentStatus)}`}>{row.paymentStatus.replaceAll("_", " ")}</span></td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.bookingStatus)}`}>{row.bookingStatus.replaceAll("_", " ")}</span></td><td className="px-3 py-4 font-black">{formatPeso(row.grossCents)}</td><td className="px-3 py-4 font-black text-rose-700">{formatPeso(row.refundCents)}</td><td className="px-3 py-4 font-black text-emerald-800">{formatPeso(row.collectedCents)}</td><td className="px-3 py-4"><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">View</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[var(--line)] lg:hidden">{transactions.map((row) => <article key={row.bookingId} className="p-5"><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-xs font-black text-[var(--forest)]">{row.reference}</span><h3 className="mt-2 font-black">{row.siteName} · {row.courtNames.join(", ")}</h3></div><strong className="text-emerald-800">{formatPeso(row.collectedCents)}</strong></div><p className="mt-3 text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.startsAt)}</p><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.paymentStatus)}`}>{row.paymentStatus.replaceAll("_", " ")}</span><span className={`rounded-full px-2 py-1 text-[0.65rem] font-black capitalize ${statusStyle(row.bookingStatus)}`}>{row.bookingStatus.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs"><span>Gross {formatPeso(row.grossCents)} · Refund {formatPeso(row.refundCents)}</span><Link href={`/merchant/bookings/${row.bookingId}`} className="rounded-full bg-[var(--forest)] px-4 py-2 font-black text-white">View</Link></div></article>)}</div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 text-xs"><span>Showing {customer.transactions.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, customer.transactions.length)} of {customer.transactions.length}</span><div className="flex items-center gap-2"><Link aria-disabled={page === 1} href={`?${new URLSearchParams({ ...(selectedSiteId ? { site: selectedSiteId } : {}), page: String(Math.max(1, page - 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">←</Link><span className="font-black">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} href={`?${new URLSearchParams({ ...(selectedSiteId ? { site: selectedSiteId } : {}), page: String(Math.min(totalPages, page + 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">→</Link></div></footer>
      </section>
    </MerchantPreviewShell>
  );
}
