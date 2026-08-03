import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { getAdminCustomers } from "@/lib/admin/customers";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Platform customers" };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const [admin, query, customers] = await Promise.all([requirePlatformAdmin(), searchParams, getAdminCustomers()]);
  const q = String(query.q ?? "").trim().toLowerCase().slice(0, 160);
  const filtered = customers.filter((customer) => !q || [customer.name, customer.email, customer.phone, ...customer.merchantNames, ...customer.siteNames].some((value) => value.toLowerCase().includes(q)));
  const pageSize = 25; const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return <AdminShell admin={admin} activeHref="/admin/customers" title="Platform customers" description="Unique customers across all Pikko merchants, with their complete booking and payment history." metrics={[
    { label: "Unique customers", value: String(customers.length), note: "Deduplicated by booking identity" },
    { label: "Returning", value: String(customers.filter((row) => row.bookingCount > 1).length), note: "Two or more bookings" },
    { label: "Active in 30 days", value: String(customers.filter((row) => row.activeInLast30Days).length), note: "Recent players" },
    { label: "Collected", value: formatPeso(customers.reduce((sum, row) => sum + row.collectedCents, 0)), note: "Successful less refunds" },
  ]}>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <form className="flex gap-3 border-b border-[var(--line)] p-4"><input name="q" defaultValue={q} placeholder="Search name, email, phone, merchant, or site" className="min-w-0 flex-1 rounded-xl border border-[var(--line)] px-4 py-3 text-sm" /><button className="rounded-full bg-[var(--forest)] px-5 py-3 text-xs font-black text-white">Search</button></form>
      <div className="overflow-x-auto"><table className="w-full min-w-[64rem] text-left text-sm"><thead className="bg-[var(--cream)] text-[0.65rem] uppercase tracking-wider text-[var(--text-muted)]"><tr>{["Customer", "Contact", "Merchants", "Sites", "Bookings", "Last booking", "Collected", ""].map((label) => <th key={label} className="px-4 py-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{visible.map((customer) => <tr key={customer.key}><td className="px-4 py-4 font-black">{customer.name}</td><td className="px-4 py-4 text-xs"><span className="block">{customer.email || "No email"}</span><span className="text-[var(--text-muted)]">{customer.phone || "No phone"}</span></td><td className="px-4 py-4 text-xs">{customer.merchantNames.join(", ")}</td><td className="px-4 py-4 text-xs">{customer.siteNames.join(", ")}</td><td className="px-4 py-4 font-black">{customer.bookingCount}</td><td className="px-4 py-4 text-xs">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(customer.lastBookingAt)}</td><td className="px-4 py-4 font-black text-emerald-800">{formatPeso(customer.collectedCents)}</td><td className="px-4 py-4"><Link href={`/admin/customers/${customer.key}`} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">History</Link></td></tr>)}</tbody></table></div>
      {!visible.length ? <p className="p-12 text-center text-sm text-[var(--text-muted)]">No customers match this search.</p> : null}
      <footer className="flex items-center justify-between border-t border-[var(--line)] px-4 py-4 text-xs"><span>{filtered.length} customer{filtered.length === 1 ? "" : "s"}</span><div className="flex gap-2"><Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(Math.max(1, page - 1)) })}`} className="rounded-full border px-3 py-2 font-black">←</Link><span className="px-2 py-2 font-black">{page} / {totalPages}</span><Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(Math.min(totalPages, page + 1)) })}`} className="rounded-full border px-3 py-2 font-black">→</Link></div></footer>
    </section>
  </AdminShell>;
}
