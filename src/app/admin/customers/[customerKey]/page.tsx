import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { getAdminCustomers } from "@/lib/admin/customers";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Customer booking history" };
export const dynamic = "force-dynamic";

export default async function AdminCustomerPage({ params }: { params: Promise<{ customerKey: string }> }) {
  const [admin, route, customers] = await Promise.all([requirePlatformAdmin(), params, getAdminCustomers()]);
  const customer = customers.find((row) => row.key === route.customerKey); if (!customer) notFound();
  return <AdminShell admin={admin} activeHref="/admin/customers" eyebrow="Platform administration · Customer" title={customer.name} description="Bookings and payment activity across every merchant." actions={<Link href="/admin/customers" className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black">← All customers</Link>} metrics={[
    { label: "Bookings", value: String(customer.bookingCount), note: `${customer.merchantNames.length} merchant${customer.merchantNames.length === 1 ? "" : "s"}` }, { label: "Gross", value: formatPeso(customer.grossCents) }, { label: "Collected", value: formatPeso(customer.collectedCents) }, { label: "Refunded", value: formatPeso(customer.refundCents) },
  ]}>
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5"><p className="font-black">{customer.email || "No email"}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{customer.phone || "No phone"} · {customer.merchantNames.join(", ")}</p></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white"><header className="border-b p-5"><h2 className="font-black">Booking history</h2></header><div className="divide-y divide-[var(--line)]">{customer.transactions.map((row) => <article key={row.bookingId} className="grid gap-3 p-5 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center"><div><p className="font-mono text-xs font-black text-[var(--forest)]">{row.reference}</p><p className="mt-1 font-black">{row.merchantName} · {row.siteName}</p><p className="text-xs text-[var(--text-muted)]">{row.courtNames.join(", ")}</p></div><p className="text-sm">{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.startsAt)}</p><div className="text-xs"><p className="font-black capitalize">{row.bookingStatus.replaceAll("_", " ")}</p><p className="mt-1 capitalize text-[var(--text-muted)]">{row.paymentStatus.replaceAll("_", " ")} · {row.paymentMethod}</p></div><div className="text-right"><p className="font-black text-emerald-800">{formatPeso(row.collectedCents)}</p><Link href={`/admin/merchants/${row.merchantId}`} className="mt-2 inline-flex text-xs font-black text-[var(--forest)]">Manage merchant →</Link></div></article>)}</div></section>
  </AdminShell>;
}
