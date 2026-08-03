import { and, asc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AvailabilityLegend,
  availabilityStateLabels,
  availabilityStateStyles,
  type AvailabilityDisplayState,
} from "@/components/availability-legend";
import { MerchantPageShell } from "@/components/merchant-page-shell";
import { getDb } from "@/db";
import { bookingItems, bookings, merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import {
  getSiteAvailability,
  type SiteAvailability,
} from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";
import { formatMerchantRole } from "@/lib/auth/permissions";

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

function isSiteAvailability(value: SiteAvailability | null): value is SiteAvailability {
  return value !== null;
}

function entryForHour(entries: ScheduleEntry[], startsAt: string, endsAt: string) {
  const starts = new Date(startsAt).getTime();
  const ends = new Date(endsAt).getTime();
  return entries.find(
    (entry) => entry.startsAt.getTime() <= starts && entry.endsAt.getTime() >= ends,
  );
}

function entryDisplayState(entry: ScheduleEntry): AvailabilityDisplayState {
  return entry.paymentStatus === "paid" ? "booked" : "held";
}

export default async function MerchantSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; site?: string; success?: string }>;
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
  const visibleSiteAccess = access.sites.filter((site) => visibleSiteIds.includes(site.id));
  const bounds = dayBounds(selectedDate);

  const [bookingRows, siteAvailabilityRows] = visibleSiteIds.length
    ? await Promise.all([
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
        Promise.all(
          visibleSiteAccess.map((site) =>
            getSiteAvailability(access.membership.merchantSlug, site.slug, selectedDate),
          ),
        ),
      ])
    : [[], []];
  const siteAvailabilities = siteAvailabilityRows.filter(isSiteAvailability);

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
    <MerchantPageShell
      merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={selectedSiteId} activeHref="/merchant/schedule"
      eyebrow="Daily operations"
      title="Court schedule"
      description="See every reservation across your courts, spot open time, and open bookings that need payment follow-up."
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
      {query.success ? (
        <p role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
          {query.success}
        </p>
      ) : null}
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

      <section className="mt-6 space-y-5">
        {siteAvailabilities.map((availability) => {
          const timeRows = Array.from(
            new Map(
              availability.courts.flatMap((court) =>
                court.schedule.map((slot) => [slot.startsAt, slot.label] as const),
              ),
            ),
          )
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([startsAt, label]) => ({ startsAt, label }));
          const scheduleByCourt = new Map(
            availability.courts.map((court) => [
              court.id,
              new Map(court.schedule.map((slot) => [slot.startsAt, slot])),
            ]),
          );

          return (
            <article key={availability.site.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Daily court grid</p>
                  <h2 className="mt-1 text-xl font-black">{availability.site.name}</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Select open time to create a booking; select a reservation to review it.</p>
                </div>
                <AvailabilityLegend states={["available", "booked", "held", "blocked", "closed", "past", "unavailable"]} />
              </header>

              {timeRows.length > 0 ? (
                <div className="mt-5 overflow-x-auto pb-2">
                  <div
                    role="grid"
                    aria-label={`${availability.site.name} court schedule`}
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `5.5rem repeat(${availability.courts.length}, minmax(9.5rem, 1fr))`,
                      minWidth: `${5.5 + availability.courts.length * 9.5}rem`,
                    }}
                  >
                    <div role="columnheader" className="sticky left-0 z-20 bg-white px-2 py-3 text-xs font-black text-[var(--text-muted)]">Time</div>
                    {availability.courts.map((court) => (
                      <div key={court.id} role="columnheader" className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-center">
                        <span className="block text-sm font-black">{court.name}</span>
                        <span className="mt-1 block text-[0.68rem] text-[var(--text-muted)]">{court.indoor ? "Indoor" : "Outdoor"}</span>
                      </div>
                    ))}

                    {timeRows.map((row) => (
                      <div key={row.startsAt} className="contents" role="row">
                        <div role="rowheader" className="sticky left-0 z-10 flex min-h-16 items-center bg-white px-2 text-sm font-black text-[var(--forest)]">{row.label}</div>
                        {availability.courts.map((court) => {
                          const slot = scheduleByCourt.get(court.id)?.get(row.startsAt);
                          const entry = slot
                            ? entryForHour(entriesByCourt.get(court.id) ?? [], slot.startsAt, slot.endsAt)
                            : undefined;
                          const state = entry ? entryDisplayState(entry) : slot?.state ?? "closed";
                          const label = entry
                            ? entry.paymentStatus === "paid" ? "Booked" : "Payment due"
                            : availabilityStateLabels[state];
                          const className = `min-h-16 rounded-xl border px-3 py-2 text-left transition ${availabilityStateStyles[state]}`;
                          const content = (
                            <>
                              <span className="block text-xs font-black">{label}</span>
                              <span className="mt-1 block truncate text-[0.68rem] opacity-75">
                                {entry
                                  ? `${entry.customerName ?? "Guest"} · ${entry.reference}`
                                  : state === "available" && slot?.rateCents != null
                                    ? formatPeso(slot.rateCents)
                                    : availabilityStateLabels[state]}
                              </span>
                            </>
                          );

                          if (entry) {
                            return (
                              <Link key={court.id} role="gridcell" href={`/merchant/bookings/${entry.bookingId}`} className={className}>
                                {content}
                              </Link>
                            );
                          }
                          if (state === "available") {
                            return (
                              <div key={court.id} role="gridcell" className={`overflow-hidden p-0 ${className}`}>
                                <Link
                                  href={`/merchant/bookings/new?site=${availability.site.id}&date=${selectedDate}&court=${court.id}&starts=${encodeURIComponent(row.startsAt)}`}
                                  className="block px-3 py-2"
                                  aria-label={`Create booking for ${court.name} at ${row.label}`}
                                >
                                  {content}
                                </Link>
                                {access.permissions.includes("manage_courts") ? (
                                  <Link
                                    href={`/merchant/blocks?site=${availability.site.id}&date=${selectedDate}&court=${court.id}&starts=${encodeURIComponent(row.startsAt)}`}
                                    className="block border-t border-sky-300 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wide hover:bg-white/50"
                                  >
                                    Block time
                                  </Link>
                                ) : null}
                              </div>
                            );
                          }
                          return (
                            <div key={court.id} role="gridcell" className={`flex min-h-16 items-center ${className}`}>
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="font-black">The site is closed on this date.</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Choose another day to inspect its court schedule.</p>
                </div>
              )}
            </article>
          );
        })}
        {!siteAvailabilities.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
            <p className="font-black">No active courts are assigned to this view.</p>
            <Link href="/merchant/sites" className="mt-4 inline-flex text-sm font-black text-[var(--forest)] underline underline-offset-4">Manage sites and courts</Link>
          </div>
        ) : null}
      </section>
    </MerchantPageShell>
  );
}
