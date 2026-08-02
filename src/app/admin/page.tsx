import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import { getDb } from "@/db";
import { bookings, courts, merchants, sites } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Platform overview" };
export const dynamic = "force-dynamic";

function localDate(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function atManilaMidnight(value: string) { return new Date(`${value}T00:00:00+08:00`); }
function addDays(value: Date, days: number) { return new Date(value.getTime() + days * 86_400_000); }
function dateRange(query: { period?: string; from?: string; to?: string }) {
  const today = atManilaMidnight(localDate(new Date())); const period = new Set(["today", "week", "month", "custom"]).has(query.period ?? "") ? query.period! : "month";
  if (period === "today") return { period, start: today, end: addDays(today, 1), label: "Today" };
  if (period === "week") { const weekday = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(today) === "Sun" ? 0 : new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" }).format(today) === "Mon" ? 1 : new Date(`${localDate(today)}T12:00:00+08:00`).getDay()); const start = addDays(today, weekday === 0 ? -6 : 1 - weekday); return { period, start, end: addDays(start, 7), label: "This week" }; }
  if (period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "")) { const start = atManilaMidnight(query.from!); const end = addDays(atManilaMidnight(query.to!), 1); if (start < end && end.getTime() - start.getTime() <= 366 * 86_400_000) return { period, start, end, label: `${query.from} to ${query.to}` }; }
  const parts = localDate(today).split("-"); const start = atManilaMidnight(`${parts[0]}-${parts[1]}-01`); const end = atManilaMidnight(localDate(new Date(Date.UTC(Number(parts[0]), Number(parts[1]), 1)))); return { period: "month", start, end, label: "This month" };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const [admin, query] = await Promise.all([requirePlatformAdmin(), searchParams]); const range = dateRange(query); const db = getDb(); const within = <T,>(column: T) => and(gte(column as never, range.start), lt(column as never, range.end));
  const [merchantCount, siteCount, courtCount, customerCount, bookingCount, recent] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int`.mapWith(Number) }).from(merchants).where(within(merchants.createdAt)),
    db.select({ count: sql<number>`count(*)::int`.mapWith(Number) }).from(sites).where(within(sites.createdAt)),
    db.select({ count: sql<number>`count(*)::int`.mapWith(Number) }).from(courts).where(within(courts.createdAt)),
    db.select({ count: sql<number>`count(distinct coalesce(lower(${bookings.customerEmail}), ${bookings.customerId}::text, ${bookings.customerMobileNumber}, ${bookings.id}::text))::int`.mapWith(Number) }).from(bookings).where(within(bookings.createdAt)),
    db.select({ count: sql<number>`count(*)::int`.mapWith(Number), total: sql<number>`coalesce(sum(case when ${bookings.paymentStatus} = 'paid' then ${bookings.totalCents} else 0 end),0)::bigint`.mapWith(Number) }).from(bookings).where(within(bookings.createdAt)),
    db.select({ id: bookings.id, reference: bookings.reference, customerName: bookings.customerName, status: bookings.status, paymentStatus: bookings.paymentStatus, totalCents: bookings.totalCents, createdAt: bookings.createdAt, merchantName: merchants.displayName, siteName: sites.name }).from(bookings).innerJoin(merchants, eq(merchants.id, bookings.merchantId)).innerJoin(sites, eq(sites.id, bookings.siteId)).where(within(bookings.createdAt)).orderBy(desc(bookings.createdAt)).limit(12),
  ]);
  return <AdminShell admin={admin} activeHref="/admin" title="Platform overview" description="Marketplace activity across merchants, venues, courts, customers, and bookings." metrics={[
    { label: "Merchants", value: String(merchantCount[0]?.count ?? 0), note: `Created · ${range.label}` }, { label: "Sites", value: String(siteCount[0]?.count ?? 0), note: `Created · ${range.label}` }, { label: "Courts", value: String(courtCount[0]?.count ?? 0), note: `Created · ${range.label}` }, { label: "Customers", value: String(customerCount[0]?.count ?? 0), note: `Booked · ${range.label}` }, { label: "Bookings", value: String(bookingCount[0]?.count ?? 0), note: `${formatPeso(bookingCount[0]?.total ?? 0)} paid value` },
  ]}>
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4"><form className="grid gap-3 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end"><label className="text-xs font-black">Period<select name="period" defaultValue={range.period} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="today">Daily / today</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="custom">Specific range</option></select></label><label className="text-xs font-black">From<input name="from" type="date" defaultValue={query.from ?? localDate(range.start)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label><label className="text-xs font-black">To<input name="to" type="date" defaultValue={query.to ?? localDate(addDays(range.end, -1))} className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal" /></label><button className="rounded-full bg-[var(--forest)] px-5 py-3 text-xs font-black text-white">Apply filter</button></form></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white"><header className="border-b border-[var(--line)] px-5 py-4"><h2 className="font-black">Recent bookings</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{range.label}</p></header><div className="divide-y divide-[var(--line)]">{recent.map((booking) => <article key={booking.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[0.7fr_1.3fr_1fr_1fr_0.6fr] sm:items-center"><span className="font-mono text-xs font-black">{booking.reference}</span><span className="font-bold">{booking.merchantName} · {booking.siteName}</span><span>{booking.customerName || "Guest"}</span><span className="text-xs capitalize">{booking.status.replaceAll("_", " ")} · {booking.paymentStatus.replaceAll("_", " ")}</span><span className="font-black sm:text-right">{formatPeso(booking.totalCents)}</span></article>)}{!recent.length ? <p className="p-12 text-center text-sm text-[var(--text-muted)]">No bookings in this period.</p> : null}</div></section>
  </AdminShell>;
}
