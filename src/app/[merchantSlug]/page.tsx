import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { HeroCourtScene } from "@/components/landing-preview/hero-court-scene";
import { MerchantSiteDirectory } from "@/components/merchant-site-directory";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";
import { getAuth } from "@/lib/auth/server";
import { getMerchantLandingMarketplace } from "@/lib/marketplace/landing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}): Promise<Metadata> {
  const { merchantSlug } = await params;
  const [merchant] = await getDb()
    .select({ name: merchants.displayName, description: merchants.description })
    .from(merchants)
    .where(and(eq(merchants.slug, merchantSlug), eq(merchants.status, "active")))
    .limit(1);
  return merchant
    ? {
        title: `${merchant.name} pickleball courts`,
        description:
          merchant.description || `Book a pickleball court at ${merchant.name}.`,
      }
    : { title: "Pickleball venues" };
}

export default async function PublicMerchantPage({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}) {
  const { merchantSlug } = await params;
  const db = getDb();
  const [[merchant], siteCards, { data: session }] = await Promise.all([
    db
      .select({
        id: merchants.id,
        name: merchants.displayName,
        slug: merchants.slug,
        description: merchants.description,
        logoUrl: merchants.logoUrl,
        logoPathname: merchants.logoPathname,
        coverUrl: merchants.coverUrl,
        coverPathname: merchants.coverPathname,
      })
      .from(merchants)
      .where(and(eq(merchants.slug, merchantSlug), eq(merchants.status, "active")))
      .limit(1),
    getMerchantLandingMarketplace(merchantSlug),
    getAuth().getSession(),
  ]);

  if (!merchant) notFound();
  if (siteCards.length === 1) redirect(`/${merchant.slug}/${siteCards[0].slug}`);

  const courtCount = siteCards.reduce(
    (total, site) => total + site.courts.length,
    0,
  );
  const openSlotCount = siteCards.reduce(
    (total, site) => total + site.availableSlotCount,
    0,
  );
  const logoUrl = merchant.logoPathname ? merchant.logoUrl : null;
  const merchantCoverUrl = merchant.coverPathname ? merchant.coverUrl : null;
  const featuredSite = siteCards[0];

  return (
    <main className="landing-preview min-h-screen overflow-hidden text-[var(--ink)]">
      <a
        href="#locations"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-black focus:text-[var(--forest)]"
      >
        Skip to locations
      </a>

      <header className="sticky top-0 z-50 border-b border-[var(--forest)]/10 bg-[var(--cream)]/82 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[4.75rem] w-full max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Brand />
          <nav aria-label="Merchant page navigation" className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="hidden rounded-full px-4 py-2 text-sm font-black text-[var(--forest)] hover:bg-white md:inline-flex">
              All venues
            </Link>
            {session?.user ? (
              <Link href="/customer" className="inline-flex min-h-11 items-center rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white shadow-[0_3px_0_#0d281a] transition hover:-translate-y-0.5 motion-reduce:transform-none">
                My Profile
              </Link>
            ) : (
              <Link href="/auth/sign-in?audience=customer&callbackURL=%2Fcustomer" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-black text-[var(--forest)] hover:bg-white">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="relative px-4 pb-14 pt-4 sm:px-6 sm:pb-20 sm:pt-6 lg:px-8">
        <div className="pointer-events-none absolute left-[-12rem] top-24 size-[32rem] rounded-full bg-[var(--lime)]/25 blur-[100px]" />
        <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--forest)] shadow-[0_35px_110px_rgb(23_60_42_/_24%)] sm:rounded-[3rem]">
          {merchantCoverUrl ? (
            <Image
              src={merchantCoverUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-10 blur-[2px]"
              priority
            />
          ) : null}
          <div className="noise absolute inset-0 opacity-20" />
          <div className="relative grid min-h-[43rem] lg:min-h-[46rem] lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative z-10 flex flex-col justify-center px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20 xl:px-20">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative size-16 overflow-hidden rounded-2xl border border-white/25 bg-white shadow-xl sm:size-20">
                    <Image
                      src={logoUrl}
                      alt={`${merchant.name} logo`}
                      fill
                      sizes="80px"
                      className="object-contain p-1.5"
                      priority
                    />
                  </div>
                ) : (
                  <div className="grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black text-[var(--lime)] sm:size-20">
                    {merchant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--lime)]">Official booking page</p>
                  <p className="mt-1 text-sm font-bold text-white/55">Powered by Pikko.ph</p>
                </div>
              </div>
              <h1 className="display-type mt-7 max-w-3xl text-[clamp(3.5rem,6.5vw,6.75rem)] font-black tracking-[-0.065em]">
                Play at<br />{merchant.name}.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-white/72 sm:text-lg">
                {merchant.description ||
                  "Choose a location, see live court availability, and book your next game in a few taps."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#locations" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--lime)] px-6 text-sm font-black text-[var(--ink)] shadow-[0_4px_0_#c3cb00] transition hover:-translate-y-0.5 motion-reduce:transform-none">
                  Choose a location
                </a>
                <span className="inline-flex min-h-12 items-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-white/75 backdrop-blur">
                  Live schedules · Secure booking
                </span>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 border-t border-white/15 pt-6">
                <Metric value={siteCards.length} label="Locations" />
                <Metric value={courtCount} label="Courts" />
                <Metric value={openSlotCount} label="Open slots" live />
              </div>
            </div>

            <div className="relative m-4 min-h-[30rem] sm:m-6 lg:ml-0 lg:min-h-0 lg:py-6 lg:pr-6">
              {featuredSite ? (
                <HeroCourtScene
                  venueName={featuredSite.name}
                  venueHref={`/${featuredSite.merchantSlug}/${featuredSite.slug}`}
                  location={`${featuredSite.city}${featuredSite.province ? `, ${featuredSite.province}` : ""}`}
                  coverUrl={merchantCoverUrl ?? featuredSite.coverUrl}
                  courts={featuredSite.courts}
                  nextAvailableLabel={featuredSite.nextAvailableLabel}
                  availableSlotCount={featuredSite.availableSlotCount}
                  sceneVariant="rally"
                />
              ) : (
                <div className="relative h-full min-h-[30rem] overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/5">
                  {merchantCoverUrl ? (
                    <Image src={merchantCoverUrl} alt={`${merchant.name} pickleball courts`} fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" priority />
                  ) : (
                    <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#315f43,#173c2a)]" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="locations" className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--paper)] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <MerchantSiteDirectory merchantSlug={merchant.slug} sites={siteCards} />

          {siteCards.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
              <p className="font-bold">No public sites are available yet.</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">Check back after the merchant finishes venue setup.</p>
            </div>
          ) : null}

          <div className="mt-16 grid gap-3 rounded-[2rem] border border-[var(--line)] bg-[#eff5d8] p-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["clock", "Live availability", "Court schedules update in real time."],
              ["calendar", "Easy booking", "Choose one hour or consecutive blocks."],
              ["shield", "Secure payments", "Online or verified manual options."],
              ["players", "For every player", "Guests and registered players welcome."],
            ].map(([icon, title, copy]) => (
              <article key={title} className="rounded-2xl bg-white/70 p-5">
                <FeatureIcon name={icon} />
                <h2 className="mt-4 text-sm font-black">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[var(--cream)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-[var(--text-muted)] sm:px-8 lg:px-12">
          <Brand compact />
          <div className="flex items-center gap-5">
            <p>Official booking page for {merchant.name}</p>
            <Link href="/" className="font-black text-[var(--forest)]">Discover more courts →</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Metric({ value, label, live = false }: { value: number; label: string; live?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <strong className="text-2xl font-black sm:text-3xl">{value}</strong>
        {live ? <span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" /> : null}
      </div>
      <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55">{label}</span>
    </div>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 2.8 7.5 7 9 4.2-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    players: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M14 15c3.5-.6 5.7 1 6.5 4" /></>,
  };
  return <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--mint)] text-[var(--forest)]"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg></span>;
}
