import type { Metadata } from "next";
import Link from "next/link";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantCustomers } from "@/lib/merchant/customers";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

function queryString(query: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...overrides })) if (value) params.set(key, value);
  return params.toString();
}

export default async function MerchantCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [access, query] = await Promise.all([requireMerchantPermission("manage_bookings"), searchParams]);
  const selectedSiteId = access.sites.some((site) => site.id === query.site) ? query.site! : "";
  const customers = await getMerchantCustomers({ merchantId: access.membership.merchantId, siteIds: access.sites.map((site) => site.id), selectedSiteId });
  const q = String(query.q ?? "").trim().toLowerCase().slice(0, 160);
  const segment = new Set(["returning", "upcoming"]).has(query.segment ?? "") ? query.segment! : "";
  const filteredCustomers = customers.filter((customer) => {
    if (segment === "returning" && customer.bookingCount < 2) return false;
    if (segment === "upcoming" && !customer.nextBookingAt) return false;
    if (q && ![customer.name, customer.email, customer.phone, ...customer.siteNames].some((value) => value.toLowerCase().includes(q))) return false;
    return true;
  });
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const visibleCustomers = filteredCustomers.slice((page - 1) * pageSize, page * pageSize);
  const normalizedQuery = { site: selectedSiteId || undefined, q: q || undefined, segment: segment || undefined };
  const activeCustomers = customers.filter((customer) => customer.activeInLast30Days).length;
  const returningCustomers = customers.filter((customer) => customer.bookingCount >= 2).length;
  const lifetimeCollected = customers.reduce((sum, customer) => sum + customer.collectedCents, 0);

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={selectedSiteId} activeHref="/merchant/customers" eyebrow="Customer relationships" title="Customers" description="A deduplicated directory of everyone who has booked one of the sites available to your account.">
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Customer summary">
        {[["Unique customers", String(customers.length), "Based on booking identity"], ["Returning customers", String(returningCustomers), "Two or more bookings"], ["Active in 30 days", String(activeCustomers), "Played within the last 30 days"], ["Collected payments", formatPeso(lifetimeCollected), "Successful less refunds"]].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.05em]">{value}</p><p className="mt-2 text-xs font-semibold text-[var(--forest)]">{note}</p></article>)}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <header className="border-b border-[var(--line)] p-4 sm:p-5">
          <form className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(12rem,0.7fr)_auto] md:items-end">
            <input type="hidden" name="site" value={selectedSiteId} />
            <label className="text-xs font-black">Search customers<input name="q" defaultValue={q} placeholder="Name, email, phone, or site" className="mt-1.5 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Customer segment<select name="segment" defaultValue={segment} className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All customers</option><option value="returning">Returning customers</option><option value="upcoming">Has upcoming booking</option></select></label>
            <div className="flex gap-2"><button className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Apply</button><Link href={selectedSiteId ? `?site=${selectedSiteId}` : "/merchant/customers"} className="rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-black">Reset</Link></div>
          </form>
        </header>

        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[64rem] text-left text-sm"><thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Customer", "Contact", "Sites", "Bookings", "Latest booking", "Next booking", "Collected", "Actions"].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{visibleCustomers.map((customer) => <tr key={customer.key}><td className="px-4 py-4"><strong className="block">{customer.name}</strong><small className="text-[var(--text-muted)]">Customer since {new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric", timeZone: "Asia/Manila" }).format(customer.firstBookingAt)}</small></td><td className="px-4 py-4"><span className="block text-xs">{customer.email || "No email"}</span><small className="text-[var(--text-muted)]">{customer.phone || "No phone"}</small></td><td className="px-4 py-4 text-xs">{customer.siteNames.join(", ")}</td><td className="px-4 py-4 font-black">{customer.bookingCount}</td><td className="px-4 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(customer.lastBookingAt)}</td><td className="px-4 py-4 text-xs">{customer.nextBookingAt ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(customer.nextBookingAt) : "—"}</td><td className="px-4 py-4 font-black text-emerald-800">{formatPeso(customer.collectedCents)}</td><td className="px-4 py-4"><Link href={`/merchant/customers/${customer.key}${selectedSiteId ? `?site=${selectedSiteId}` : ""}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">View history</Link></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-[var(--line)] md:hidden">{visibleCustomers.map((customer) => <article key={customer.key} className="p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-black">{customer.name}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{customer.email || customer.phone || "No contact details"}</p></div><strong className="text-emerald-800">{formatPeso(customer.collectedCents)}</strong></div><p className="mt-4 text-sm">{customer.bookingCount} booking{customer.bookingCount === 1 ? "" : "s"} · {customer.siteNames.join(", ")}</p><div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-xs"><span>Last: {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(customer.lastBookingAt)}</span><Link href={`/merchant/customers/${customer.key}${selectedSiteId ? `?site=${selectedSiteId}` : ""}`} className="rounded-full bg-[var(--forest)] px-4 py-2 font-black text-white">View history</Link></div></article>)}</div>
        {!visibleCustomers.length ? <p className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">No customers match these filters.</p> : null}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-4 text-xs"><span>Showing {filteredCustomers.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredCustomers.length)} of {filteredCustomers.length}</span><div className="flex items-center gap-2"><Link aria-disabled={page === 1} href={`?${queryString(normalizedQuery, { page: String(Math.max(1, page - 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">←</Link><span className="font-black">Page {page} of {totalPages}</span><Link aria-disabled={page === totalPages} href={`?${queryString(normalizedQuery, { page: String(Math.min(totalPages, page + 1)) })}`} className="rounded-full border border-[var(--line)] px-3 py-2 font-black">→</Link></div></footer>
      </section>
    </MerchantPreviewShell>
  );
}
