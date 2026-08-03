import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { HeroCourtScene } from "@/components/landing-preview/hero-court-scene";
import { getAuth } from "@/lib/auth/server";
import type { LandingSlot } from "@/lib/marketplace/landing";
import { getLandingMarketplace } from "@/lib/marketplace/landing";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const experienceSteps = [
  {
    number: "01",
    title: "Find your court",
    copy: "Explore active venues with real schedules, prices, and court details.",
    icon: "search" as const,
  },
  {
    number: "02",
    title: "Build your session",
    copy: "Compare every court by hour and select consecutive open blocks.",
    icon: "calendar" as const,
  },
  {
    number: "03",
    title: "Pay and play",
    copy: "Confirm through Maya QR Ph or the venue's verified manual payment flow.",
    icon: "check" as const,
  },
];

export default async function LandingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    courtType?: string;
    date?: string;
  }>;
}) {
  const query = await searchParams;
  const requestedDate = DATE_PATTERN.test(query.date ?? "")
    ? query.date
    : undefined;
  const [marketplaceSites, { data: session }] = await Promise.all([
    getLandingMarketplace(requestedDate),
    getAuth().getSession(),
  ]);
  const activeDate = requestedDate ?? marketplaceSites[0]?.availabilityDate ?? "";
  const searchTerm = (query.q ?? "").trim().toLowerCase();
  const cityFilter = (query.city ?? "").trim();
  const courtType =
    query.courtType === "indoor" || query.courtType === "outdoor"
      ? query.courtType
      : "any";
  const cities = Array.from(
    new Set(marketplaceSites.map((site) => site.city)),
  ).sort((left, right) => left.localeCompare(right));
  const hasFilters = Boolean(
    searchTerm || cityFilter || courtType !== "any" || requestedDate,
  );
  const filteredSites = marketplaceSites.filter((site) => {
    if (cityFilter && site.city !== cityFilter) return false;
    if (courtType === "indoor" && !site.courts.some((court) => court.indoor)) {
      return false;
    }
    if (courtType === "outdoor" && !site.courts.some((court) => !court.indoor)) {
      return false;
    }
    if (!searchTerm) return true;
    return [
      site.name,
      site.merchantName,
      site.city,
      site.province ?? "",
      ...site.amenities,
      ...site.courts.flatMap((court) => [court.name, court.surfaceType ?? ""]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm);
  });
  const featuredSite = filteredSites[0] ?? marketplaceSites[0];
  const totalCourts = marketplaceSites.reduce(
    (total, site) => total + site.courts.length,
    0,
  );
  const totalOpenSlots = marketplaceSites.reduce(
    (total, site) => total + site.availableSlotCount,
    0,
  );
  const activeDateLabel = activeDate ? formatLongDate(activeDate) : "Today";

  return (
    <main className="landing-preview min-h-screen overflow-hidden text-[var(--ink)]">
      <a
        href="#courts"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-black focus:text-[var(--forest)]"
      >
        Skip to available courts
      </a>

      <header className="sticky top-0 z-50 border-b border-[var(--forest)]/10 bg-[var(--cream)]/82 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[4.75rem] w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Brand />
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary navigation">
            <Link href="#courts" className="hidden rounded-full px-4 py-2 text-sm font-black text-[var(--forest)] hover:bg-white md:inline-flex">
              Find a court
            </Link>
            {session?.user ? (
              <Link href="/customer" className="inline-flex min-h-11 items-center rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white shadow-[0_3px_0_#0d281a] transition hover:-translate-y-0.5 motion-reduce:transform-none">
                My Profile
              </Link>
            ) : (
              <Link href="/auth/sign-in?audience=customer&callbackURL=%2Fcustomer" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-black text-[var(--forest)] hover:bg-white sm:px-4">
                Login
              </Link>
            )}
            <Link href="/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant" className="inline-flex min-h-11 items-center rounded-full border border-[var(--forest)]/15 bg-white px-3 text-center text-xs font-black text-[var(--forest)] transition hover:border-[var(--forest)] sm:px-5 sm:text-sm">
              Partner Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative px-4 pb-14 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8">
        <div className="pointer-events-none absolute left-[-12rem] top-24 size-[32rem] rounded-full bg-[var(--lime)]/25 blur-[100px]" />
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--forest)] shadow-[0_35px_110px_rgb(23_60_42_/_24%)] sm:rounded-[3rem]">
          <div className="noise absolute inset-0 opacity-20" />
          <div className="relative grid min-h-[43rem] lg:min-h-[46rem] lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative z-10 flex flex-col justify-center px-6 pb-12 pt-12 text-white sm:px-10 sm:py-16 lg:px-16 lg:pb-24 lg:pt-20 xl:px-20">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.17em] text-white/80 backdrop-blur">
                <span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_14px_var(--lime)]" />
                Live schedules · {activeDateLabel}
              </div>
              <h1 className="display-type mt-7 max-w-4xl text-[clamp(3.5rem,7vw,7.25rem)] font-black tracking-[-0.065em]">
                Find your court.
                <br />
                Pick your hour.
                <br />
                <span className="text-[var(--lime)]">Play.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-white/72 sm:text-lg">
                Live pickleball availability from real venues. Compare courts, choose consecutive hour blocks, and confirm in a few taps.
              </p>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 border-t border-white/15 pt-6">
                <Metric value={marketplaceSites.length} label="Venues" />
                <Metric value={totalCourts} label="Courts" />
                <Metric value={totalOpenSlots} label="Open slots" live />
              </div>
            </div>

            <div className="relative m-4 min-h-[30rem] sm:m-6 lg:ml-0 lg:min-h-0 lg:py-6 lg:pr-6">
              {featuredSite ? (
                <HeroCourtScene
                  venueName={featuredSite.name}
                  venueHref={`/${featuredSite.merchantSlug}/${featuredSite.slug}`}
                  location={`${featuredSite.city}${featuredSite.province ? `, ${featuredSite.province}` : ""}`}
                  coverUrl={featuredSite.coverUrl}
                  courts={featuredSite.courts}
                  nextAvailableLabel={featuredSite.nextAvailableLabel}
                  availableSlotCount={featuredSite.availableSlotCount}
                  sceneVariant="equipment"
                />
              ) : (
                <div className="grid h-full min-h-[30rem] place-items-center rounded-[1.75rem] border border-white/15 bg-white/5 px-8 text-center text-white/70">
                  Active venues will appear here automatically.
                </div>
              )}
            </div>
          </div>

          <form action="/#courts" className="relative z-30 m-4 mt-0 grid gap-3 rounded-[1.5rem] border border-white/25 bg-white/95 p-4 shadow-[0_22px_70px_rgb(0_0_0_/_24%)] backdrop-blur-2xl sm:m-6 sm:mt-0 sm:p-5 lg:-mt-4 lg:grid-cols-[1.25fr_0.75fr_0.8fr_auto] lg:items-end">
            <label className="text-xs font-black text-[var(--forest)]">
              Where do you want to play?
              <span className="relative mt-2 block">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"><LandingIcon name="search" /></span>
                <input name="q" defaultValue={query.q ?? ""} placeholder="Venue, city, or amenity" className="min-h-13 w-full rounded-xl border border-[var(--line)] bg-white pl-11 pr-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]" />
              </span>
            </label>
            <label className="text-xs font-black text-[var(--forest)]">
              City
              <select name="city" defaultValue={cityFilter} className="mt-2 min-h-13 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]">
                <option value="">All cities</option>
                {cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label className="text-xs font-black text-[var(--forest)]">
              Playing date
              <input name="date" type="date" defaultValue={activeDate} className="mt-2 min-h-13 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]" />
            </label>
            <button className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-7 text-sm font-black text-[var(--ink)] shadow-[0_4px_0_#c3cb00] transition hover:-translate-y-0.5 motion-reduce:transform-none">
              See live courts <LandingIcon name="arrow" />
            </button>
          </form>
        </div>
      </section>

      <section id="courts" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--paper)] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--coral)]">Live marketplace · {activeDateLabel}</p>
              <h2 className="display-type mt-4 max-w-3xl text-5xl font-black sm:text-7xl">Courts you can book now.</h2>
            </div>
            <div className="max-w-lg">
              <p className="text-sm leading-6 text-[var(--text-muted)]">Availability below is calculated from each court’s operating hours, price rules, bookings, active checkout holds, and merchant blocks.</p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[var(--text-muted)]">
                <Legend color="bg-[var(--lime)]" label="Open" />
                <Legend color="bg-[#d8ddd7]" label="Taken" />
                <Legend color="bg-[#ffd9d0]" label="Blocked" />
              </div>
            </div>
          </div>

          <form action="/#courts" className="mt-9 grid gap-3 rounded-[1.75rem] border border-[var(--line)] bg-white p-4 shadow-[0_16px_45px_rgb(23_34_26_/_6%)] md:grid-cols-[1.25fr_0.8fr_0.7fr_0.8fr_auto] md:items-end">
            <FilterInput label="Search courts" name="q" defaultValue={query.q ?? ""} placeholder="Venue, city, surface…" />
            <label className="text-xs font-black text-[var(--forest)]">City<select name="city" defaultValue={cityFilter} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal"><option value="">All cities</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label className="text-xs font-black text-[var(--forest)]">Court type<select name="courtType" defaultValue={courtType} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal"><option value="any">Any</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select></label>
            <label className="text-xs font-black text-[var(--forest)]">Playing date<input name="date" type="date" defaultValue={activeDate} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal" /></label>
            <button className="min-h-12 rounded-full bg-[var(--forest)] px-6 text-sm font-black text-white transition hover:bg-[var(--ink)]">Update</button>
          </form>

          <div className="my-6 flex items-center justify-between gap-4 text-sm">
            <p className="font-black text-[var(--forest)]" aria-live="polite">{filteredSites.length} {filteredSites.length === 1 ? "venue" : "venues"} found</p>
            {hasFilters ? <Link href="/#courts" className="text-xs font-black underline underline-offset-4">Clear filters</Link> : null}
          </div>

          {filteredSites.length > 0 ? (
            <div className={`grid gap-6 lg:grid-cols-2 ${filteredSites.length <= 2 ? "mx-auto max-w-6xl" : "xl:grid-cols-3"}`}>
              {filteredSites.map((site, index) => (
                <VenueAvailabilityCard key={site.id} site={site} priority={index < 2} date={activeDate} />
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 px-6 py-16 text-center">
              <h3 className="text-xl font-black">No live courts match those filters.</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Try another city, date, or court type.</p>
            </div>
          )}
        </div>
      </section>

      <section className="relative mx-auto max-w-[90rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--coral)]">From search to serve</p>
            <h2 className="display-type mt-4 text-5xl font-black sm:text-7xl">Three moves.<br />One great game.</h2>
            <p className="mt-6 max-w-md leading-7 text-[var(--text-muted)]">Every visual step reflects the same flow customers use when they reserve a real court.</p>
          </div>
          <div className="space-y-5">
            {experienceSteps.map((step) => (
              <article key={step.number} className="group grid min-h-52 gap-6 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-[0_18px_50px_rgb(23_60_42_/_6%)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgb(23_60_42_/_12%)] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8 motion-reduce:transform-none">
                <div className="grid size-16 place-items-center rounded-2xl bg-[var(--forest)] text-[var(--lime)] shadow-[0_8px_0_#d9f3df]"><LandingIcon name={step.icon} large /></div>
                <div><p className="font-mono text-xs font-black text-[var(--coral)]">{step.number}</p><h3 className="mt-2 text-2xl font-black sm:text-3xl">{step.title}</h3><p className="mt-3 max-w-xl leading-7 text-[var(--text-muted)]">{step.copy}</p></div>
                <span className="hidden text-[var(--forest)]/20 transition group-hover:translate-x-2 group-hover:text-[var(--forest)] sm:block motion-reduce:transform-none"><LandingIcon name="arrow" large /></span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto mb-8 w-[calc(100%_-_2.5rem)] max-w-[87.5rem] overflow-hidden rounded-[2.5rem] bg-[var(--lime)] px-6 py-14 sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
        <div className="noise absolute inset-0 opacity-40" />
        <div className="relative"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--forest)]/65">For venue partners · 14 days free</p><h2 className="display-type mt-4 max-w-3xl text-5xl font-black sm:text-6xl">Try the complete system.<br />Free for 14 days.</h2><p className="mt-5 max-w-xl text-sm leading-6 text-[var(--forest)]/75">Publish live schedules, manage multiple sites, verify payments, and understand utilization. Set up your workspace now and explore every core booking tool during your trial.</p></div>
        <div className="relative mt-8 flex flex-wrap gap-3 lg:mt-0 lg:max-w-sm lg:justify-end">
          <Link href={session?.user ? "/merchant/onboarding" : "/auth/sign-up?audience=merchant&callbackURL=%2Fmerchant%2Fonboarding"} className="inline-flex min-h-13 items-center gap-2 rounded-full bg-[var(--ink)] px-7 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[var(--forest)] motion-reduce:transform-none">Start 14-day free trial <LandingIcon name="arrow" /></Link>
          <Link href="/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant" className="inline-flex min-h-13 items-center rounded-full border border-[var(--forest)]/25 bg-white/40 px-6 text-sm font-black text-[var(--forest)] transition hover:-translate-y-0.5 hover:bg-white motion-reduce:transform-none">Partner login</Link>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 px-5 py-9 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand compact />
        <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="#courts" className="font-bold hover:text-[var(--ink)]">Find a court</Link><Link href="/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant" className="font-bold hover:text-[var(--ink)]">Partner Dashboard</Link><span>© 2026 Pikko.ph</span></div>
      </footer>
    </main>
  );
}

type LandingSite = Awaited<ReturnType<typeof getLandingMarketplace>>[number];

function VenueAvailabilityCard({ site, priority, date }: { site: LandingSite; priority: boolean; date: string }) {
  const href = `/${site.merchantSlug}/${site.slug}${date ? `?date=${date}` : ""}`;
  const location = `${site.city}${site.province ? `, ${site.province}` : ""}`;
  const indoorCount = site.courts.filter((court) => court.indoor).length;

  return (
    <article className="group flex min-h-[38rem] flex-col overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[0_20px_65px_rgb(23_34_26_/_8%)] transition duration-300 hover:-translate-y-1.5 hover:border-[var(--forest)] hover:shadow-[0_28px_80px_rgb(23_60_42_/_14%)] motion-reduce:transform-none">
      <Link href={href} aria-label={`View booking availability for ${site.name}`} className="relative block aspect-[16/9] overflow-hidden bg-[var(--forest)] focus-visible:z-10">
        {site.coverUrl ? <Image src={site.coverUrl} alt={`${site.name} pickleball venue`} fill sizes="(max-width: 1024px) 100vw, (max-width: 1440px) 50vw, 33vw" className="object-cover transition duration-700 group-hover:scale-[1.04] motion-reduce:transform-none" priority={priority} /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#315f43,#173c2a)]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white backdrop-blur"><span className={`size-2 rounded-full ${site.availableSlotCount > 0 ? "bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" : "bg-white/45"}`} />{site.availableSlotCount > 0 ? "Live availability" : "No open slots"}</span>
        <span className="absolute bottom-4 right-4 rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black">{site.courts.length} {site.courts.length === 1 ? "court" : "courts"}</span>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <Link href={`/${site.merchantSlug}`} className="w-fit text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--coral)] hover:text-[var(--forest)]">{site.merchantName} <span aria-hidden="true">→</span></Link>
        <div className="mt-2 flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black"><Link href={href} className="decoration-[var(--lime)] decoration-4 underline-offset-4 hover:underline">{site.name}</Link></h3><p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)]"><LandingIcon name="location" /> {location}</p></div><span className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-[0.65rem] font-black text-[var(--forest)]">{indoorCount > 0 && indoorCount < site.courts.length ? "Mixed" : indoorCount > 0 ? "Indoor" : "Outdoor"}</span></div>

        <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--cream)]/65 p-3">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Next hourly slots</p><span className="text-[0.65rem] font-black text-[var(--forest)]">{site.availableSlotCount} open</span></div>
          <div className="space-y-2">
            {site.courts.slice(0, 2).map((court) => (
              <div key={court.id} className="grid grid-cols-[5rem_1fr] items-center gap-2">
                <span className="truncate text-[0.68rem] font-black text-[var(--forest)]">{court.name}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {court.previewSlots.length > 0 ? court.previewSlots.map((slot) => <SlotCell key={slot.startsAt} slot={slot} />) : <span className="col-span-4 rounded-lg bg-white px-2 py-2 text-center text-[0.62rem] font-bold text-[var(--text-muted)]">No future hours</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div><p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">{site.nextAvailableLabel ? `Next open · ${site.nextAvailableLabel}` : "Current rate"}</p><p className="mt-1 text-xl font-black text-[var(--forest)]">{formatPeso(site.liveStartingRateCents)}<span className="text-xs font-bold text-[var(--text-muted)]"> / hour</span></p></div>
          <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--forest)] px-4 text-xs font-black text-white transition group-hover:bg-[var(--ink)]">View slots <LandingIcon name="arrow" /></Link>
        </div>
      </div>
    </article>
  );
}

function SlotCell({ slot }: { slot: LandingSlot }) {
  const style = slot.state === "available" ? "bg-[var(--lime)] text-[var(--ink)]" : slot.state === "booked" || slot.state === "held" ? "bg-[#d8ddd7] text-[var(--text-muted)]" : slot.state === "blocked" ? "bg-[#ffd9d0] text-[#7b2f21]" : "bg-white text-[var(--text-muted)]/55";
  return <span title={`${slot.label}: ${slot.state}`} className={`truncate rounded-lg px-1 py-2 text-center text-[0.58rem] font-black ${style}`}>{slot.label.replace(":00", "")}</span>;
}

function Metric({ value, label, live = false }: { value: number; label: string; live?: boolean }) {
  return <div><div className="flex items-center gap-2"><strong className="text-2xl font-black sm:text-3xl">{value}</strong>{live ? <span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" /> : null}</div><span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55">{label}</span></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`size-3 rounded-sm border border-black/5 ${color}`} />{label}</span>;
}

function FilterInput({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder: string }) {
  return <label className="text-xs font-black text-[var(--forest)]">{label}<input name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-4 text-base font-normal" /></label>;
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

type IconName = "arrow" | "calendar" | "check" | "location" | "search";

function LandingIcon({ name, large = false }: { name: IconName; large?: boolean }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  };
  return <svg viewBox="0 0 24 24" width={large ? 28 : 19} height={large ? 28 : 19} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
