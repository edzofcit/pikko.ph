import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { MarketplaceCourtGrid } from "@/components/marketplace-court-grid";
import { getAuth } from "@/lib/auth/server";
import { getMarketplaceSites } from "@/lib/marketplace/courts";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";

const steps = [
  ["01", "Find your court", "Browse nearby venues and compare live hourly rates."],
  ["02", "Pick a slot", "Choose one hour or stack consecutive blocks in a tap."],
  ["03", "Pay and play", "Confirm securely with Maya QR Ph or merchant payment instructions."],
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type LandingIconName = "arrow" | "calendar" | "check" | "search";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    courtType?: string;
    date?: string;
  }>;
}) {
  const [query, marketplaceSites, { data: session }] = await Promise.all([
    searchParams,
    getMarketplaceSites(),
    getAuth().getSession(),
  ]);
  const searchTerm = (query.q ?? "").trim().toLowerCase();
  const cityFilter = (query.city ?? "").trim();
  const courtType =
    query.courtType === "indoor" || query.courtType === "outdoor"
      ? query.courtType
      : "any";
  const bookingDate = DATE_PATTERN.test(query.date ?? "")
    ? query.date
    : undefined;
  const cities = Array.from(
    new Set(marketplaceSites.map((site) => site.city)),
  ).sort((left, right) => left.localeCompare(right));
  const hasFilters = Boolean(
    searchTerm || cityFilter || courtType !== "any" || bookingDate,
  );
  const filteredSites = marketplaceSites.filter((site) => {
    if (cityFilter && site.city !== cityFilter) return false;
    if (
      courtType === "indoor" &&
      !site.courts.some((court) => court.indoor)
    ) {
      return false;
    }
    if (
      courtType === "outdoor" &&
      !site.courts.some((court) => !court.indoor)
    ) {
      return false;
    }
    if (!searchTerm) return true;

    const searchable = [
      site.name,
      site.merchantName,
      site.city,
      site.province ?? "",
      ...site.amenities,
      ...site.courts.flatMap((court) => [
        court.name,
        court.surfaceType ?? "",
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(searchTerm);
  });
  const featuredSite = marketplaceSites[0];
  const featuredCourt = featuredSite?.courts.reduce((lowest, court) =>
    court.hourlyRateCents < lowest.hourlyRateCents ? court : lowest,
  );
  const featuredHref = featuredSite
    ? `/${featuredSite.merchantSlug}/${featuredSite.slug}`
    : "/merchant";

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <a href="#courts" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-black focus:text-[var(--forest)]">Skip to courts</a>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--cream)]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[4.75rem] w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Brand />
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary navigation">
            {session?.user ? (
              <Link href="/customer" className="inline-flex min-h-11 items-center rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white shadow-[0_3px_0_#0d281a] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] motion-reduce:transform-none">My Profile</Link>
            ) : (
              <>
                <Link href="/auth/sign-in?audience=customer&callbackURL=%2Fcustomer" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-black text-[var(--forest)] transition-colors duration-200 hover:bg-white sm:px-4">Login</Link>
                <Link href="/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-3 text-center text-xs font-black text-[var(--forest)] transition-colors duration-200 hover:border-[var(--forest)] sm:px-5 sm:text-sm">Partner Dashboard</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="px-4 pb-14 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--forest)] shadow-[0_28px_90px_rgb(23_60_42_/_20%)] sm:rounded-[2.75rem]">
          <div className="noise absolute inset-0 opacity-25" />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[56px] border-[var(--lime)]/85" />
          <div className="relative grid min-h-[39rem] lg:grid-cols-[1.03fr_0.97fr]">
            <div className="flex flex-col justify-center px-6 pb-8 pt-12 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/85 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> Live court availability
              </div>
              <h1 className="display-type mt-6 max-w-3xl text-5xl font-black tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">Your court.<br />Your time.<br /><span className="text-[var(--lime)]">Ready to play.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">Discover pickleball venues, compare current hourly prices, and reserve consecutive slots without waiting for a reply.</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-white/70">
                <span className="inline-flex items-center gap-2"><LandingIcon name="check" /> Guest checkout</span>
                <span className="inline-flex items-center gap-2"><LandingIcon name="check" /> Real-time schedules</span>
                <span className="inline-flex items-center gap-2"><LandingIcon name="check" /> Secure payment</span>
              </div>
            </div>

            <div className="relative m-4 min-h-[23rem] overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#315f43] sm:m-6 sm:min-h-[30rem] lg:ml-0 lg:min-h-0">
              {featuredSite?.coverUrl ? <Image src={featuredSite.coverUrl} alt={`${featuredSite.name} pickleball venue`} fill sizes="(max-width: 1024px) 100vw, 48vw" className="object-cover" priority /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#315f43,#173c2a)]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/15" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.17em] text-[var(--lime)]">{featuredSite ? "Featured venue" : "For venue partners"}</p>
                <div className="mt-2 flex items-end justify-between gap-5">
                  <div>
                    <h2 className="text-2xl font-black sm:text-3xl">{featuredSite?.name ?? "Bring your courts online"}</h2>
                    <p className="mt-2 text-sm text-white/70">{featuredSite ? `${featuredSite.merchantName} · ${featuredSite.city}` : "Publish schedules and accept bookings with Pikko.ph"}</p>
                    <p className="mt-3 font-black">{featuredCourt && featuredSite ? `From ${formatPeso(featuredSite.startingRateCents)} / hour` : "Simple court operations"}</p>
                  </div>
                  <Link href={featuredHref} aria-label={featuredSite ? `View ${featuredSite.name}` : "Open partner dashboard"} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[var(--ink)] transition duration-200 hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none"><LandingIcon name="arrow" /></Link>
                </div>
              </div>
            </div>
          </div>

          <form action="/#courts" className="relative z-10 m-4 mt-0 grid gap-3 rounded-[1.5rem] border border-white/20 bg-white/95 p-4 shadow-[0_20px_60px_rgb(0_0_0_/_18%)] backdrop-blur-xl sm:m-6 sm:mt-0 sm:p-5 lg:-mt-5 lg:grid-cols-[1.3fr_0.85fr_0.85fr_auto] lg:items-end">
            <label className="text-xs font-black text-[var(--forest)]">Where do you want to play?<span className="relative mt-2 block"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--forest)]"><LandingIcon name="search" /></span><input name="q" defaultValue={query.q ?? ""} placeholder="Venue, city, or amenity" className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-white pl-11 pr-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]" /></span></label>
            <label className="text-xs font-black text-[var(--forest)]">City<select name="city" defaultValue={cityFilter} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"><option value="">All cities</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
            <label className="text-xs font-black text-[var(--forest)]">Playing date<input name="date" type="date" defaultValue={bookingDate} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]" /></label>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--lime)] px-6 text-sm font-black text-[var(--ink)] shadow-[0_4px_0_#c3cb00] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] motion-reduce:transform-none">Find a court <LandingIcon name="arrow" /></button>
          </form>
        </div>
      </section>

      <section id="courts" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--paper)] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--coral)]">Live marketplace</p>
              <h2 className="display-type mt-3 text-4xl font-black sm:text-5xl">
                Courts you can book now.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
              Browse active venues already on Pikko.ph. Each card links to real court schedules, current hourly prices, and server-checked availability.
            </p>
          </div>
          <form
            action="/#courts"
            className="mb-7 grid gap-3 rounded-[1.75rem] border border-[var(--line)] bg-white p-4 shadow-[0_14px_40px_rgb(23_34_26_/_6%)] md:grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr_auto] md:items-end"
          >
            <label className="text-xs font-black text-[var(--forest)]">
              Search courts
              <input
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Venue, city, surface…"
                className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"
              />
            </label>
            <label className="text-xs font-black text-[var(--forest)]">
              City
              <select
                name="city"
                defaultValue={cityFilter}
                className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"
              >
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-[var(--forest)]">
              Court type
              <select
                name="courtType"
                defaultValue={courtType}
                className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"
              >
                <option value="any">Any</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </label>
            <label className="text-xs font-black text-[var(--forest)]">
              Playing date
              <input
                name="date"
                type="date"
                defaultValue={bookingDate}
                className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-4 text-base font-normal outline-none focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"
              />
            </label>
            <button className="min-h-12 rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white transition-colors hover:bg-[var(--ink)]">
              Find courts
            </button>
          </form>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="font-bold text-[var(--forest)]" aria-live="polite">
              {filteredSites.length} {filteredSites.length === 1 ? "venue" : "venues"} found
            </p>
            {hasFilters ? (
              <Link href="/#courts" className="text-xs font-black text-[var(--forest)] underline underline-offset-4">
                Clear all filters
              </Link>
            ) : null}
          </div>
          <MarketplaceCourtGrid
            sites={filteredSites}
            date={bookingDate}
            filtered={hasFilters}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
        <div className="mx-auto mb-10 max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--coral)]">How it works</p><h2 className="display-type mt-3 text-4xl font-black sm:text-5xl">From search to serve in three steps.</h2></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map(([number, title, description]) => (
            <article
              key={number}
              className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-6 shadow-[0_12px_35px_rgb(23_60_42_/_5%)]"
            >
              <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--mint)] text-[var(--forest)]"><LandingIcon name={number === "01" ? "search" : number === "02" ? "calendar" : "check"} /></span><span className="font-mono text-xs font-bold text-[var(--coral)]">{number}</span></div>
              <h3 className="mt-6 text-xl font-black">{title}</h3>
              <p className="mt-2 leading-7 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto mb-8 w-[calc(100%_-_2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--lime)] px-6 py-12 sm:px-10 lg:flex lg:items-center lg:justify-between">
        <div className="noise absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--forest)]/70">
            Run your venue on Pikko
          </p>
          <h2 className="display-type mt-3 max-w-2xl text-4xl font-black sm:text-5xl">
            More court time. Less admin time.
          </h2>
        </div>
        <Link
          href={session?.user ? "/merchant" : "/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant"}
          className="relative mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 text-sm font-black text-white transition duration-200 hover:-translate-y-0.5 lg:mt-0 motion-reduce:transform-none"
        >
          Open Partner Dashboard <LandingIcon name="arrow" />
        </Link>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <Brand compact />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="#courts" className="font-bold hover:text-[var(--ink)]">Find a court</Link>
          <Link href={session?.user ? "/merchant" : "/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant"} className="font-bold hover:text-[var(--ink)]">Partner Dashboard</Link>
          <span>© 2026 Pikko.ph</span>
        </div>
      </footer>
    </main>
  );
}

function LandingIcon({ name }: { name: LandingIconName }) {
  const paths: Record<LandingIconName, ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
