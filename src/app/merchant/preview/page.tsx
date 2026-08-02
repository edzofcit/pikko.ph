import { and, asc, desc, eq, gte, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { getDb } from "@/db";
import {
  bookingItems,
  bookings,
  courts,
  merchantMemberships,
  merchants,
  sites,
} from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getSiteAvailability, type SiteAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Merchant overview preview" };
export const dynamic = "force-dynamic";

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayBounds(value: string) {
  return {
    start: new Date(`${value}T00:00:00+08:00`),
    end: new Date(`${addDays(value, 1)}T00:00:00+08:00`),
  };
}

function isAvailability(value: SiteAvailability | null): value is SiteAvailability {
  return value !== null;
}

function statusStyle(status: string) {
  if (status === "available") return "bg-emerald-100 text-emerald-800";
  if (status === "booked") return "bg-amber-100 text-amber-900";
  if (status === "blocked" || status === "maintenance") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-600";
}

export default async function MerchantPreviewOverview({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const [access, query] = await Promise.all([getMerchantAccess(), searchParams]);
  if (!access?.user) redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/preview")}`);
  if (!access.membership) redirect("/merchant/onboarding");

  const selectedSiteId = access.sites.some((site) => site.id === query.site) ? query.site! : "";
  const visibleSites = selectedSiteId
    ? access.sites.filter((site) => site.id === selectedSiteId)
    : access.sites;
  const visibleSiteIds = visibleSites.map((site) => site.id);
  const db = getDb();
  const [{ today, currentTime }] = await db
    .select({
      today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`,
      currentTime: sql<Date>`CURRENT_TIMESTAMP`,
    })
    .from(merchants)
    .where(eq(merchants.id, access.membership.merchantId))
    .limit(1);
  const bounds = dayBounds(today);

  const [bookingRows, availabilityRows, maintenanceRows, pendingInvitations] = visibleSiteIds.length
    ? await Promise.all([
        db
          .select({
            id: bookings.id,
            reference: bookings.reference,
            customerName: bookings.customerName,
            siteName: sites.name,
            courtName: courts.name,
            startsAt: bookingItems.startsAt,
            endsAt: bookingItems.endsAt,
            status: bookings.status,
            paymentStatus: bookings.paymentStatus,
            totalCents: bookings.totalCents,
          })
          .from(bookings)
          .innerJoin(sites, eq(sites.id, bookings.siteId))
          .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
          .innerJoin(courts, eq(courts.id, bookingItems.courtId))
          .where(and(
            eq(bookings.merchantId, access.membership.merchantId),
            inArray(bookings.siteId, visibleSiteIds),
            gte(bookingItems.startsAt, bounds.start),
            lt(bookingItems.startsAt, bounds.end),
            notInArray(bookings.status, ["cancelled", "expired"]),
          ))
          .orderBy(desc(bookingItems.startsAt)),
        Promise.all(visibleSites.map((site) => getSiteAvailability(access.membership!.merchantSlug, site.slug, today))),
        db
          .select({ id: courts.id, name: courts.name, siteName: sites.name })
          .from(courts)
          .innerJoin(sites, eq(sites.id, courts.siteId))
          .where(and(
            eq(courts.merchantId, access.membership.merchantId),
            inArray(courts.siteId, visibleSiteIds),
            eq(courts.status, "maintenance"),
          ))
          .orderBy(asc(sites.name), asc(courts.name)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(merchantMemberships)
          .where(and(
            eq(merchantMemberships.merchantId, access.membership.merchantId),
            eq(merchantMemberships.status, "invited"),
          )),
      ])
    : [[], [], [], [{ count: 0 }]];

  const availabilities = availabilityRows.filter(isAvailability);
  const uniqueBookings = new Map<string, (typeof bookingRows)[number]>();
  for (const booking of bookingRows) uniqueBookings.set(booking.id, booking);
  const bookingList = Array.from(uniqueBookings.values());
  const paidRevenue = bookingList
    .filter((booking) => booking.paymentStatus === "paid")
    .reduce((sum, booking) => sum + booking.totalCents, 0);
  const upcomingCount = bookingList.filter((booking) => booking.startsAt > currentTime).length;
  const pendingBookings = bookingList.filter((booking) => booking.paymentStatus === "pending" || booking.paymentStatus === "unpaid");

  const nowMs = currentTime.getTime();
  const courtCards = availabilities.flatMap((availability) =>
    availability.courts.map((court) => {
      const usable = court.schedule.filter((slot) => ["available", "booked", "held"].includes(slot.state));
      const utilizedCount = usable.filter((slot) => slot.state === "booked" || slot.state === "held").length;
      const current = court.schedule.find((slot) => new Date(slot.startsAt).getTime() <= nowMs && new Date(slot.endsAt).getTime() > nowMs);
      const nextBusy = court.schedule.find((slot) => new Date(slot.startsAt).getTime() > nowMs && (slot.state === "booked" || slot.state === "held"));
      const nextOpen = court.schedule.find((slot) => new Date(slot.startsAt).getTime() > nowMs && slot.state === "available");
      const state = current?.state === "booked" || current?.state === "held"
        ? "booked"
        : current?.state === "blocked"
          ? "blocked"
          : current?.state === "available"
            ? "available"
            : "closed";
      return { id: court.id, name: court.name, siteName: availability.site.name, state, nextBusy, nextOpen, availableCount: usable.length, utilizedCount };
    }),
  );
  const { availableHours, utilizedHours } = courtCards.reduce(
    (totals, court) => ({
      availableHours: totals.availableHours + court.availableCount,
      utilizedHours: totals.utilizedHours + court.utilizedCount,
    }),
    { availableHours: 0, utilizedHours: 0 },
  );
  const utilization = availableHours ? Math.round((utilizedHours / availableHours) * 100) : 0;
  const courtCounts = courtCards.reduce<Record<string, number>>((counts, court) => {
    counts[court.state] = (counts[court.state] ?? 0) + 1;
    return counts;
  }, {});
  const attentionCount = pendingBookings.length + maintenanceRows.length + pendingInvitations[0].count;
  const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  const siteParam = selectedSiteId ? `?site=${selectedSiteId}` : "";

  return (
    <MerchantPreviewShell
      merchantName={access.membership.merchantName}
      merchantSlug={access.membership.merchantSlug}
      userName={access.user.fullName}
      userEmail={access.user.email}
      roleLabel={formatMerchantRole(access.membership.role)}
      permissions={access.permissions}
      sites={access.sites}
      selectedSiteId={selectedSiteId}
      activeHref="/merchant/preview"
      eyebrow="Merchant dashboard preview"
      title={access.membership.merchantName}
      description={`${dateLabel} · Live operational view for ${selectedSiteId ? visibleSites[0]?.name : "all assigned sites"}.`}
      actions={access.permissions.includes("manage_bookings") ? (
        <Link href="/merchant/bookings/new" className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">+ New booking</Link>
      ) : undefined}
    >
      {!visibleSiteIds.length ? (
        <section className="mt-7 rounded-3xl border border-dashed border-[var(--line)] bg-white p-10 text-center">
          <h2 className="text-xl font-black">Add your first site to get started.</h2>
          {access.permissions.includes("manage_courts") ? <Link href="/merchant/venues" className="mt-5 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Add site</Link> : null}
        </section>
      ) : (
        <>
          <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Today summary">
            {[
              ["Revenue today", formatPeso(paidRevenue), "Paid bookings played today"],
              ["Bookings today", String(bookingList.length), `${upcomingCount} upcoming`],
              ["Court utilization", `${utilization}%`, `${utilizedHours} of ${availableHours} court-hours`],
              ["Needs attention", String(attentionCount), "Operational actions"],
            ].map(([label, value, note]) => (
              <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5">
                <p className="text-xs font-bold text-[var(--text-muted)]">{label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{value}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--forest)]">{note}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 grid gap-5 2xl:grid-cols-[0.9fr_1.6fr]">
            <article className="overflow-hidden rounded-2xl border border-amber-200 bg-[#fffaf0]">
              <header className="border-b border-amber-200 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">Needs your attention</p>
              </header>
              <div className="divide-y divide-amber-200">
                {pendingBookings.slice(0, 3).map((booking) => (
                  <Link key={booking.id} href={`/merchant/bookings/${booking.id}`} className="flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-white/60">
                    <span><strong className="block">Payment requires review</strong><span className="mt-1 block text-xs text-amber-900/70">{booking.reference} · {booking.customerName ?? "Guest"}</span></span><span aria-hidden="true">›</span>
                  </Link>
                ))}
                {maintenanceRows.slice(0, 2).map((court) => (
                  <Link key={court.id} href={`/merchant/blocks${siteParam}`} className="flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-white/60">
                    <span><strong className="block">Court under maintenance</strong><span className="mt-1 block text-xs text-amber-900/70">{court.siteName} · {court.name}</span></span><span aria-hidden="true">›</span>
                  </Link>
                ))}
                {pendingInvitations[0].count ? (
                  <Link href="/merchant/team" className="flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-white/60"><span><strong className="block">Staff invitations pending</strong><span className="mt-1 block text-xs text-amber-900/70">{pendingInvitations[0].count} waiting for acceptance</span></span><span>›</span></Link>
                ) : null}
                {!attentionCount ? <p className="px-5 py-8 text-center text-sm text-amber-900/70">You’re all caught up.</p> : null}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-black">Court status</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Current conditions across this scope</p></div>
                <Link href={`/merchant/schedule${siteParam}`} className="text-xs font-black text-[var(--forest)]">View full schedule →</Link>
              </header>
              <div className="mt-4 flex flex-wrap gap-2">
                {["available", "booked", "blocked", "closed"].map((status) => <span key={status} className={`rounded-full px-3 py-1.5 text-xs font-black capitalize ${statusStyle(status)}`}>{courtCounts[status] ?? 0} {status}</span>)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {courtCards.slice(0, 8).map((court) => (
                  <div key={court.id} className="rounded-xl border border-[var(--line)] p-4">
                    <p className="text-[0.68rem] font-bold text-[var(--text-muted)]">{court.siteName}</p>
                    <h3 className="mt-1 font-black">{court.name}</h3>
                    <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-black capitalize ${statusStyle(court.state)}`}>{court.state}</span>
                    <p className="mt-3 text-[0.68rem] leading-5 text-[var(--text-muted)]">{court.nextBusy ? `Next booking ${court.nextBusy.label}` : court.nextOpen ? `Next open ${court.nextOpen.label}` : "No more slots today"}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><h2 className="font-black">Recent bookings</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Today’s latest reservations</p></div><Link href={`/merchant/preview/bookings${siteParam}`} className="text-xs font-black text-[var(--forest)]">View all bookings →</Link></header>
            <div className="divide-y divide-[var(--line)]">
              {bookingList.slice(0, 8).map((booking) => (
                <Link key={booking.id} href={`/merchant/bookings/${booking.id}`} className="grid gap-2 px-5 py-4 text-sm hover:bg-[var(--cream)] sm:grid-cols-[0.8fr_1.1fr_1fr_1fr_0.6fr] sm:items-center">
                  <span className="font-mono text-xs font-black text-[var(--forest)]">{booking.reference}</span><span><strong className="block">{booking.customerName ?? "Guest"}</strong><small className="text-[var(--text-muted)]">{booking.siteName} · {booking.courtName}</small></span><span className="text-xs">{new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(booking.startsAt)}</span><span className="flex gap-1"><small className="rounded-full bg-emerald-100 px-2 py-1 font-bold capitalize">{booking.paymentStatus.replaceAll("_", " ")}</small><small className="rounded-full bg-slate-100 px-2 py-1 font-bold capitalize">{booking.status.replaceAll("_", " ")}</small></span><strong className="sm:text-right">{formatPeso(booking.totalCents)}</strong>
                </Link>
              ))}
              {!bookingList.length ? <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No bookings yet today.</p> : null}
            </div>
          </section>
        </>
      )}
    </MerchantPreviewShell>
  );
}
