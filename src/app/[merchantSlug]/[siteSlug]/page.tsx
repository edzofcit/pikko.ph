import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sitePhotos } from "@/db/schema";
import { getSiteAvailability } from "@/lib/booking/availability";
import { SlotPicker } from "./slot-picker";
import { SiteLocationMap } from "@/components/site-location-map";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Court availability" };
export const dynamic = "force-dynamic";

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function mondayOfWeek(value: string) {
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(value, -daysSinceMonday);
}

function dateLabel(value: string, earliestDate: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const shortDate = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);

  return {
    weekday: value === earliestDate ? "Today" : weekday,
    shortDate,
  };
}

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantSlug: string; siteSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ merchantSlug, siteSlug }, query] = await Promise.all([params, searchParams]);
  const availability = await getSiteAvailability(merchantSlug, siteSlug, query.date);
  if (!availability) notFound();
  const [coverPhoto] = await getDb()
    .select({ url: sql<string>`'/api/venue-photos/site/' || ${sitePhotos.id}::text`, altText: sitePhotos.altText })
    .from(sitePhotos)
    .where(and(eq(sitePhotos.siteId, availability.site.id), eq(sitePhotos.isCover, true)))
    .limit(1);

  const address = `${availability.site.addressLine1}, ${availability.site.city}${
    availability.site.province ? `, ${availability.site.province}` : ""
  }`;
  const hasMapLocation = Boolean(availability.site.latitude && availability.site.longitude);
  const calendarWeekStart = mondayOfWeek(availability.date);
  const quickDateStart =
    calendarWeekStart < availability.earliestDate
      ? availability.earliestDate
      : calendarWeekStart;
  const dateOptions = Array.from({ length: 7 }, (_, index) =>
    addDays(quickDateStart, index),
  ).filter((value) => value <= availability.latestDate);
  const previousWeekCandidate = addDays(calendarWeekStart, -1);
  const previousWeekDate =
    previousWeekCandidate >= availability.earliestDate
      ? previousWeekCandidate
      : null;
  const nextWeekCandidate = addDays(calendarWeekStart, 7);
  const nextWeekDate =
    nextWeekCandidate <= availability.latestDate ? nextWeekCandidate : null;
  const sitePath = `/${availability.merchant.slug}/${availability.site.slug}`;
  const availableSlotCount = availability.courts.reduce(
    (total, court) => total + court.slots.length,
    0,
  );
  const startingRateCents = availability.courts.length
    ? Math.min(...availability.courts.map((court) => court.baseHourlyRateCents))
    : 0;
  const selectedDateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${availability.date}T00:00:00Z`));

  return (
    <main className="booking-page min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-[var(--forest)]/10 bg-[var(--cream)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Link href={`/${availability.merchant.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--forest)] shadow-sm">
            <BookingIcon name="back" /> {availability.merchant.name}
          </Link>
          <Link href="/" aria-label="Pikko.ph home" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-black text-[var(--forest)]">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--lime)]"><span className="size-3 rounded-full bg-[var(--forest)]" /></span>
            pikko<span className="text-[var(--coral)]">.ph</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[90rem] px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--forest)] shadow-[0_30px_90px_rgb(23_60_42_/_20%)] sm:rounded-[3rem]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative min-h-[25rem] overflow-hidden bg-[#214e38] sm:min-h-[31rem] lg:min-h-[38rem]">
              {coverPhoto ? (
                <Image src={coverPhoto.url} alt={coverPhoto.altText || `${availability.site.name} venue`} fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover" />
              ) : (
                <div className="booking-court-pattern absolute inset-0" aria-hidden="true" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#081b12]/95 via-[#102c20]/25 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9 lg:p-12">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 text-[0.65rem] font-black uppercase tracking-[0.16em] backdrop-blur"><span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" /> Live booking</span>
                  <span className="inline-flex min-h-8 items-center rounded-full border border-white/20 bg-black/30 px-3 text-[0.65rem] font-black uppercase tracking-[0.12em] backdrop-blur">{availability.courts.length} {availability.courts.length === 1 ? "court" : "courts"}</span>
                </div>
                <h1 className="display-type mt-5 max-w-3xl text-[clamp(3rem,7vw,6.5rem)] font-black">{availability.site.name}</h1>
                <p className="mt-5 flex max-w-2xl items-start gap-2 text-sm font-semibold leading-6 text-white/82 sm:text-base"><BookingIcon name="pin" /> <span>{address}</span></p>
              </div>
            </div>

            <aside className="relative flex flex-col justify-between bg-[var(--lime)] p-6 sm:p-9 lg:p-12">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--forest)]/65">Your match board</p>
                <p className="mt-3 text-2xl font-black leading-tight text-[var(--forest)] sm:text-3xl">{selectedDateLabel}</p>
                <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--forest)]/75">{availability.site.description || "Choose an open court and build your session one hour at a time."}</p>

                <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
                  <BookingStat value={String(availableSlotCount)} label="Open slots" />
                  <BookingStat value={String(availability.courts.length)} label="Courts" />
                  <BookingStat value={startingRateCents ? formatPeso(startingRateCents) : "—"} label="From / hour" compact />
                </div>
              </div>

              <form method="get" className="mt-9 rounded-[1.5rem] bg-[var(--forest)] p-4 text-white shadow-[0_18px_45px_rgb(23_60_42_/_24%)] sm:p-5">
                <label className="block text-xs font-black uppercase tracking-[0.12em] text-white/65">
                  Change playing date
                  <span className="relative mt-2 block">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--forest)]"><BookingIcon name="calendar" /></span>
                    <input name="date" type="date" required min={availability.earliestDate} max={availability.latestDate} defaultValue={availability.date} className="min-h-13 w-full rounded-xl border-0 bg-white pl-12 pr-3 text-base font-bold text-[var(--ink)] outline-none focus:ring-4 focus:ring-white/35" />
                  </span>
                </label>
                <button type="submit" className="mt-3 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[var(--forest)]">Update match board <BookingIcon name="arrow" /></button>
              </form>
            </aside>
          </div>
        </div>

        <ol aria-label="Booking progress" className="mt-4 grid grid-cols-3 gap-2 rounded-[1.5rem] border border-[var(--line)] bg-white p-2 text-xs font-black shadow-[0_12px_35px_rgb(23_60_42_/_7%)] sm:mt-6 sm:gap-3 sm:p-3">
          <li aria-current="step" className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[var(--forest)] px-2 text-center text-white"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[var(--ink)]">1</span><span>Choose time</span></li>
          <li className="flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-center text-[var(--text-muted)]"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--cream)]">2</span><span>Your details</span></li>
          <li className="flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-center text-[var(--text-muted)]"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--cream)]">3</span><span>Payment</span></li>
        </ol>

        <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_18px_55px_rgb(23_60_42_/_8%)] sm:p-7" aria-labelledby="match-day-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--coral)]">Match day</p>
              <h2 id="match-day-heading" className="mt-1 text-2xl font-black text-[var(--forest)] sm:text-3xl">Pick a day to play</h2>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                {availableSlotCount} open {availableSlotCount === 1 ? "slot" : "slots"} on the selected date
              </p>
            </div>
            <nav aria-label="Change quick-date week" className="flex items-center gap-2">
              {previousWeekDate ? (
                <Link
                  href={`${sitePath}?date=${previousWeekDate}`}
                  aria-label="Previous week"
                  className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--forest)] hover:border-[var(--forest)]"
                >
                  <BookingIcon name="back" />
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-[var(--text-muted)] opacity-50"><BookingIcon name="back" /></span>
              )}
              <span className="px-1 text-xs font-black text-[var(--forest)]">Selected week</span>
              {nextWeekDate ? (
                <Link
                  href={`${sitePath}?date=${nextWeekDate}`}
                  aria-label="Next week"
                  className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--forest)] hover:border-[var(--forest)]"
                >
                  <BookingIcon name="arrow" />
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-[var(--text-muted)] opacity-50"><BookingIcon name="arrow" /></span>
              )}
            </nav>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 overflow-x-auto pb-2">
            {dateOptions.map((value) => {
              const label = dateLabel(value, availability.earliestDate);
              const selected = value === availability.date;
              return (
                <Link
                  key={value}
                  href={`${sitePath}?date=${value}`}
                  aria-current={selected ? "date" : undefined}
                  className={`min-h-[4.75rem] min-w-[4.75rem] shrink-0 rounded-2xl border px-3 py-3 text-center transition ${
                    selected
                      ? "border-[var(--forest)] bg-[var(--lime)] text-[var(--ink)] shadow-[0_5px_0_var(--forest)]"
                      : "border-[var(--line)] bg-white hover:border-[var(--forest)] hover:bg-[var(--mint)]"
                  }`}
                >
                  <span className="block text-xs font-black">{label.weekday}</span>
                  <span className={`mt-1 block text-xs ${selected ? "text-[var(--forest)]/70" : "text-[var(--text-muted)]"}`}>
                    {label.shortDate}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-muted)]">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--cream)] px-3"><BookingIcon name="clock" /> 1-hour minimum</span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--cream)] px-3"><BookingIcon name="plus" /> Tap adjacent times to extend</span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--cream)] px-3"><BookingIcon name="tag" /> Live prices per hour</span>
          </div>
        </section>

        <div id="availability" className="mt-6 scroll-mt-24">
          {availability.courts.length > 0 ? (
            <SlotPicker
              courts={availability.courts}
              date={availability.date}
              checkoutPath={`/${availability.merchant.slug}/${availability.site.slug}/checkout`}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
              <p className="font-bold">No active courts are published for this site yet.</p>
            </div>
          )}
        </div>

        {hasMapLocation ? <SiteLocationMap latitude={availability.site.latitude!} longitude={availability.site.longitude!} siteName={availability.site.name} address={address} tileUrl={process.env.OSM_TILE_URL} /> : null}
      </section>
    </main>
  );
}

function BookingStat({ value, label, compact = false }: { value: string; label: string; compact?: boolean }) {
  return <div className="rounded-2xl border border-[var(--forest)]/10 bg-white/55 p-3 text-[var(--forest)] backdrop-blur"><strong className={`block font-black tabular-nums ${compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"}`}>{value}</strong><span className="mt-1 block text-[0.6rem] font-black uppercase tracking-[0.1em] text-[var(--forest)]/60">{label}</span></div>;
}

function BookingIcon({ name }: { name: "arrow" | "back" | "calendar" | "clock" | "pin" | "plus" | "tag" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {name === "arrow" ? <path d="M5 12h14m-5-5 5 5-5 5" /> : null}
      {name === "back" ? <path d="M19 12H5m5 5-5-5 5-5" /> : null}
      {name === "calendar" ? <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></> : null}
      {name === "clock" ? <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></> : null}
      {name === "pin" ? <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></> : null}
      {name === "plus" ? <path d="M12 5v14M5 12h14" /> : null}
      {name === "tag" ? <><path d="M20 13 13 20 4 11V4h7Z" /><circle cx="8.5" cy="8.5" r="1" /></> : null}
    </svg>
  );
}
