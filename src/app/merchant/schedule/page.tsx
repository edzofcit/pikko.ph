import { and, asc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import { bookingItems, bookings, courts, merchants, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Court schedule" };
export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function dayBounds(value: string) {
  return {
    start: new Date(`${value}T00:00:00+08:00`),
    end: new Date(`${addDays(value, 1)}T00:00:00+08:00`),
  };
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function displayTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

type ScheduleEntry = {
  bookingId: string;
  reference: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  customerName: string | null;
  status: string;
  paymentStatus: string;
  totalCents: number;
  source: string;
};

export default async function MerchantSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; site?: string }>;
}) {
  const [access, query] = await Promise.all([
    requireMerchantPermission("manage_bookings"),
    searchParams,
  ]);
  const db = getDb();
  const [{ today }] = await db
    .select({
      today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`,
    })
    .from(merchants)
    .where(eq(merchants.id, access.membership.merchantId))
    .limit(1);
  const selectedDate = DATE_PATTERN.test(query.date ?? "")
    ? query.date!
    : today;
  const allowedSiteIds = access.sites.map((site) => site.id);
  const selectedSiteId = allowedSiteIds.includes(query.site ?? "")
    ? query.site!
    : "";
  const visibleSiteIds = selectedSiteId ? [selectedSiteId] : allowedSiteIds;
  const bounds = dayBounds(selectedDate);

  const [visibleCourts, bookingRows] = visibleSiteIds.length
    ? await Promise.all([
        db
          .select({
            id: courts.id,
            name: courts.name,
            siteId: courts.siteId,
            siteName: sites.name,
            indoor: courts.indoor,
            surfaceType: courts.surfaceType,
            sortOrder: courts.sortOrder,
          })
          .from(courts)
          .innerJoin(sites, eq(sites.id, courts.siteId))
          .where(
            and(
              eq(courts.merchantId, access.membership.merchantId),
              inArray(courts.siteId, visibleSiteIds),
              eq(courts.status, "active"),
            ),
          )
          .orderBy(asc(sites.name), asc(courts.sortOrder), asc(courts.name)),
        db
          .select({
            bookingId: bookings.id,
            reference: bookings.reference,
            courtId: bookingItems.courtId,
            startsAt: bookingItems.startsAt,
            endsAt: bookingItems.endsAt,
            customerName: bookings.customerName,
            status: bookings.status,
            paymentStatus: bookings.paymentStatus,
            totalCents: bookings.totalCents,
            source: bookings.source,
          })
          .from(bookingItems)
          .innerJoin(
            bookings,
            and(
              eq(bookings.id, bookingItems.bookingId),
              eq(bookings.merchantId, bookingItems.merchantId),
            ),
          )
          .where(
            and(
              eq(bookings.merchantId, access.membership.merchantId),
              inArray(bookings.siteId, visibleSiteIds),
              gte(bookingItems.startsAt, bounds.start),
              lt(bookingItems.startsAt, bounds.end),
              notInArray(bookings.status, ["cancelled", "expired"]),
            ),
          )
          .orderBy(asc(bookingItems.startsAt)),
      ])
    : [[], []];

  const entriesByCourt = new Map<string, ScheduleEntry[]>();
  for (const row of bookingRows) {
    const courtEntries = entriesByCourt.get(row.courtId) ?? [];
    const previous = courtEntries.at(-1);
    if (
      previous?.bookingId === row.bookingId &&
      previous.endsAt.getTime() === row.startsAt.getTime()
    ) {
      previous.endsAt = row.endsAt;
    } else {
      courtEntries.push({ ...row });
    }
    entriesByCourt.set(row.courtId, courtEntries);
  }

  const uniqueBookings = new Map(
    bookingRows.map((booking) => [booking.bookingId, booking]),
  );
  const paidTotal = Array.from(uniqueBookings.values())
    .filter((booking) => booking.paymentStatus === "paid")
    .reduce((total, booking) => total + booking.totalCents, 0);
  const pendingPayments = Array.from(uniqueBookings.values()).filter(
    (booking) =>
      booking.paymentStatus === "pending" ||
      booking.paymentStatus === "unpaid",
  ).length;
  const siteQuery = selectedSiteId ? `&site=${selectedSiteId}` : "";

  return (
    <DashboardShell
      eyebrow={`Daily operations · ${access.membership.merchantName}`}
      title="Court schedule"
      description="See every reservation across your courts, spot open time, and open bookings that need payment follow-up."
      navigation={[
        { href: "/merchant", label: "Dashboard" },
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/venues", label: "Sites & courts" }]
          : []),
        { href: "/customer", label: "Customer mode" },
      ]}
      primaryAction={{
        href: "/merchant/bookings/new",
        label: "+ Create booking",
      }}
      metrics={[
        { label: "Bookings", value: String(uniqueBookings.size), note: displayDate(selectedDate) },
        { label: "Booked hours", value: String(bookingRows.length), note: "Hourly court blocks" },
        { label: "Paid value", value: formatPeso(paidTotal), note: "Paid bookings on this day" },
        { label: "Needs attention", value: String(pendingPayments), note: "Pending payments" },
      ]}
    >
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-black text-[var(--forest)]">
            Schedule date
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-black text-[var(--forest)]">
            Site
            <select
              name="site"
              defaultValue={selectedSiteId}
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal"
            >
              <option value="">All assigned sites</option>
              {access.sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </label>
          <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
            Update view
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <Link href={`/merchant/schedule?date=${addDays(selectedDate, -1)}${siteQuery}`} className="rounded-full bg-[var(--cream)] px-4 py-2 text-xs font-black text-[var(--forest)]">← Previous day</Link>
          <p className="text-center text-sm font-black">{displayDate(selectedDate)}</p>
          <Link href={`/merchant/schedule?date=${addDays(selectedDate, 1)}${siteQuery}`} className="rounded-full bg-[var(--cream)] px-4 py-2 text-xs font-black text-[var(--forest)]">Next day →</Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {visibleCourts.map((court) => {
          const entries = entriesByCourt.get(court.id) ?? [];
          return (
            <article key={court.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">{court.siteName}</p>
                  <h2 className="mt-1 text-lg font-black">{court.name}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-black ${entries.length ? "bg-[var(--mint)] text-[var(--forest)]" : "bg-[var(--cream)] text-[var(--text-muted)]"}`}>
                  {entries.length ? `${entries.length} scheduled` : "Open day"}
                </span>
              </header>
              <div className="divide-y divide-[var(--line)]">
                {entries.map((entry) => (
                  <Link
                    key={`${entry.bookingId}-${entry.startsAt.toISOString()}`}
                    href={`/merchant/bookings/${entry.bookingId}`}
                    className="grid gap-3 px-5 py-4 transition hover:bg-[var(--paper)] sm:grid-cols-[6.5rem_1fr_auto] sm:items-center"
                  >
                    <p className="font-black text-[var(--forest)]">
                      {displayTime(entry.startsAt)}–{displayTime(entry.endsAt)}
                    </p>
                    <div>
                      <p className="text-sm font-black">{entry.customerName ?? "Guest customer"}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {entry.reference} · {entry.source.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-black text-[var(--forest)]">{entry.paymentStatus.replaceAll("_", " ")}</span>
                      <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black text-[var(--text-muted)]">{entry.status.replaceAll("_", " ")}</span>
                    </div>
                  </Link>
                ))}
                {!entries.length ? (
                  <div className="px-5 py-10 text-center">
                    <p className="font-black">No bookings scheduled.</p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">This court is currently open for the selected day.</p>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {!visibleCourts.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center lg:col-span-2">
            <p className="font-black">No active courts are assigned to this view.</p>
            <Link href="/merchant/venues" className="mt-4 inline-flex text-sm font-black text-[var(--forest)] underline underline-offset-4">Manage sites and courts</Link>
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
