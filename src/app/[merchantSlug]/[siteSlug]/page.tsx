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

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href={`/${availability.merchant.slug}`} className="font-black text-[var(--forest)]">
            ← {availability.merchant.name}
          </Link>
          <Link href="/" className="text-sm font-black text-[var(--forest)]">Pikko.ph</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {coverPhoto ? (
          <div className="relative mb-8 aspect-[16/7] overflow-hidden rounded-[2rem] bg-[var(--cream)]">
            <Image src={coverPhoto.url} alt={coverPhoto.altText || `${availability.site.name} venue`} fill priority sizes="(max-width: 1200px) 100vw, 1152px" className="object-cover" />
          </div>
        ) : null}
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">Book a court</p>
            <h1 className="display-type mt-3 text-5xl font-black sm:text-7xl">{availability.site.name}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
              {availability.site.description || address}
            </p>
            {availability.site.description ? (
              <p className="mt-2 text-sm font-semibold text-[var(--forest)]">{address}</p>
            ) : null}
          </div>

          <form method="get" className="rounded-3xl border border-[var(--line)] bg-white p-5">
            <label className="block text-sm font-black">
              Playing date
              <input
                name="date"
                type="date"
                required
                min={availability.earliestDate}
                max={availability.latestDate}
                defaultValue={availability.date}
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
              />
            </label>
            <button type="submit" className="mt-3 w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
              Show availability
            </button>
          </form>
        </div>

        <ol className="mt-8 grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-xs font-black sm:max-w-2xl">
          <li className="bg-[var(--forest)] px-3 py-3 text-center text-white">1 · Choose time</li>
          <li className="px-3 py-3 text-center text-[var(--text-muted)]">2 · Your details</li>
          <li className="px-3 py-3 text-center text-[var(--text-muted)]">3 · Payment</li>
        </ol>

        <div className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Quick date</p>
              <p className="mt-1 text-sm font-semibold text-[var(--forest)]">
                {availableSlotCount} open {availableSlotCount === 1 ? "slot" : "slots"} on the selected date
              </p>
            </div>
            <nav aria-label="Change quick-date week" className="flex items-center gap-2">
              {previousWeekDate ? (
                <Link
                  href={`${sitePath}?date=${previousWeekDate}`}
                  aria-label="Previous week"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-black text-[var(--forest)] hover:border-[var(--forest)]"
                >
                  ←
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-sm text-[var(--text-muted)] opacity-50">←</span>
              )}
              <span className="text-xs font-black text-[var(--forest)]">Selected week</span>
              {nextWeekDate ? (
                <Link
                  href={`${sitePath}?date=${nextWeekDate}`}
                  aria-label="Next week"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-black text-[var(--forest)] hover:border-[var(--forest)]"
                >
                  →
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--cream)] text-sm text-[var(--text-muted)] opacity-50">→</span>
              )}
            </nav>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {dateOptions.map((value) => {
              const label = dateLabel(value, availability.earliestDate);
              const selected = value === availability.date;
              return (
                <Link
                  key={value}
                  href={`${sitePath}?date=${value}`}
                  aria-current={selected ? "date" : undefined}
                  className={`min-w-20 shrink-0 rounded-2xl border px-4 py-3 text-center transition ${
                    selected
                      ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                      : "border-[var(--line)] bg-white hover:border-[var(--forest)]"
                  }`}
                >
                  <span className="block text-xs font-black">{label.weekday}</span>
                  <span className={`mt-1 block text-xs ${selected ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                    {label.shortDate}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-muted)]">
          <span className="rounded-full bg-white px-3 py-2">1-hour minimum</span>
          <span className="rounded-full bg-white px-3 py-2">Tap adjacent times to extend</span>
          <span className="rounded-full bg-white px-3 py-2">Live prices per hour</span>
        </div>

        <div className="mt-8">
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
