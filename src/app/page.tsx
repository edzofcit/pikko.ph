import Link from "next/link";
import { Brand } from "@/components/brand";
import { MarketplaceCourtGrid } from "@/components/marketplace-court-grid";
import { getMarketplaceSites } from "@/lib/marketplace/courts";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";

const steps = [
  ["01", "Find your court", "Browse nearby venues and compare live hourly rates."],
  ["02", "Pick a slot", "Choose one hour or stack consecutive blocks in a tap."],
  ["03", "Pay and play", "Confirm securely with Maya QR Ph or merchant payment instructions."],
];

export default async function Home() {
  const marketplaceSites = await getMarketplaceSites();
  const featuredSite = marketplaceSites[0];
  const featuredCourt = featuredSite?.courts.reduce((lowest, court) =>
    court.hourlyRateCents < lowest.hourlyRateCents ? court : lowest,
  );
  const featuredHref = featuredSite
    ? `/${featuredSite.merchantSlug}/${featuredSite.slug}`
    : "/merchant";

  return (
    <main>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Brand />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary navigation">
          <Link
            href="/auth/sign-in?audience=customer&callbackURL=%2Fcustomer"
            className="hidden rounded-full px-3 py-2.5 text-sm font-semibold text-[var(--forest)] transition hover:bg-white/70 md:inline-flex"
          >
            Customer login
          </Link>
          <Link
            href="/auth/sign-in?audience=merchant&callbackURL=%2Fmerchant"
            className="rounded-full border border-[var(--line)] bg-white/60 px-3 py-2.5 text-sm font-bold text-[var(--forest)] transition hover:bg-white"
          >
            Merchant login
          </Link>
          <Link
            href="#courts"
            className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_#8fa71f] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#8fa71f]"
          >
            Find a court
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-16 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-24">
        <div className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--forest)]">
            <span className="h-2 w-2 rounded-full bg-[var(--coral)]" />
            Court time, simplified
          </div>
          <h1 className="display-type max-w-3xl text-6xl font-black text-[var(--ink)] sm:text-7xl lg:text-[5.7rem]">
            Pick a court.
            <br />
            Pick a time.
            <br />
            <span className="relative inline-block">
              Play.
              <span className="absolute -bottom-1 left-0 -z-10 h-5 w-full -rotate-1 rounded-full bg-[var(--lime)]" />
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            See real availability, compare hourly prices, and lock in your next
            pickleball session without the group-chat scramble.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#courts"
              className="rounded-full bg-[var(--forest)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_5px_0_#0d281a] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#0d281a]"
            >
              Browse open slots
            </Link>
            <span className="text-sm font-medium text-[var(--muted)]">
              Guest checkout available
            </span>
          </div>
        </div>

        <div className="relative min-h-[430px] overflow-hidden rounded-[2.25rem] border border-[var(--forest)]/20 bg-[var(--forest)] p-5 shadow-[0_24px_80px_rgb(23_60_42_/_18%)] sm:p-8">
          <div className="noise absolute inset-0 opacity-40" />
          <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full border-[42px] border-[var(--lime)]/90" />
          <div className="relative flex h-full min-h-[370px] flex-col justify-between">
            <div className="flex items-start justify-between text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                  {featuredSite ? "Now in the marketplace" : "List your pickleball venue"}
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {featuredSite ? featuredSite.name : "Reach players on Pikko.ph"}
                </p>
              </div>
              <Link
                href={featuredHref}
                aria-label={featuredSite ? `View ${featuredSite.name}` : "List your venue"}
                className="grid h-14 w-14 place-items-center rounded-full bg-[var(--lime)] text-2xl text-[var(--ink)] transition hover:translate-x-0.5"
              >
                ↗
              </Link>
            </div>
            <div className="mx-auto grid aspect-[1.7] w-[90%] place-items-center rounded-[1.5rem] border-4 border-white/90 bg-[#4f9565] p-4 shadow-[0_18px_50px_rgb(0_0_0_/_28%)] sm:w-[82%]">
              <div className="relative h-full w-full border-2 border-white/90">
                <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white/90" />
                <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-white/90" />
                <span className="absolute left-1/2 top-1/2 h-[44%] w-[26%] -translate-x-1/2 -translate-y-1/2 border-2 border-white/90" />
                <span className="absolute right-[17%] top-[28%] h-8 w-8 rounded-full bg-[var(--lime)] shadow-[0_8px_12px_rgb(0_0_0_/_24%)]" />
              </div>
            </div>
            <div className="flex items-end justify-between text-white">
              <div>
                <p className="text-sm text-white/60">
                  {featuredSite
                    ? `${featuredSite.merchantName} · ${featuredSite.city}`
                    : "Built for Philippine court operators"}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {featuredCourt
                    ? `${featuredCourt.name} · ${formatPeso(featuredSite.startingRateCents)}/hr`
                    : "Publish courts and live availability"}
                </p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                {featuredSite
                  ? `${featuredSite.courts.length} ${featuredSite.courts.length === 1 ? "court" : "courts"}`
                  : "Merchant onboarding"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="courts" className="border-y border-[var(--line)] bg-[var(--paper)] py-18 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral)]">
                Live marketplace
              </p>
              <h2 className="display-type mt-3 text-4xl font-black sm:text-5xl">
                Your next rally starts here.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
              Browse active venues already on Pikko.ph. Each card links to real court schedules, current hourly prices, and server-checked availability.
            </p>
          </div>
          <MarketplaceCourtGrid sites={marketplaceSites} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-18 sm:px-8 sm:py-24 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map(([number, title, description]) => (
            <article
              key={number}
              className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6 transition hover:-translate-y-1 hover:bg-white"
            >
              <span className="font-mono text-xs font-bold text-[var(--coral)]">{number}</span>
              <h3 className="mt-8 text-xl font-bold">{title}</h3>
              <p className="mt-2 leading-7 text-[var(--muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-8 w-[calc(100%_-_2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--lime)] px-6 py-12 sm:px-10 lg:flex lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--forest)]/70">
            Run your venue on Pikko
          </p>
          <h2 className="display-type mt-3 max-w-2xl text-4xl font-black sm:text-5xl">
            More court time. Less admin time.
          </h2>
        </div>
        <Link
          href="/merchant"
          className="mt-7 inline-flex rounded-full bg-[var(--ink)] px-6 py-3.5 text-sm font-bold text-white lg:mt-0"
        >
          Preview merchant dashboard
        </Link>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <Brand compact />
        <div className="flex gap-5">
          <Link href="/admin" className="hover:text-[var(--ink)]">Admin</Link>
          <Link href="/customer" className="hover:text-[var(--ink)]">Customer</Link>
          <Link href="/merchant" className="hover:text-[var(--ink)]">Merchant</Link>
          <span>© 2026 Pikko.ph</span>
        </div>
      </footer>
    </main>
  );
}
