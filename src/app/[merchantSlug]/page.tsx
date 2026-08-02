import { and, asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { MerchantSiteDirectory } from "@/components/merchant-site-directory";
import { getDb } from "@/db";
import { courts, merchants, sitePhotos, sites } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ merchantSlug: string }> }): Promise<Metadata> {
  const { merchantSlug } = await params;
  const [merchant] = await getDb().select({ name: merchants.displayName, description: merchants.description }).from(merchants).where(and(eq(merchants.slug, merchantSlug), eq(merchants.status, "active"))).limit(1);
  return merchant ? { title: `${merchant.name} pickleball courts`, description: merchant.description || `Book a pickleball court at ${merchant.name}.` } : { title: "Pickleball venues" };
}

export default async function PublicMerchantPage({ params }: { params: Promise<{ merchantSlug: string }> }) {
  const { merchantSlug } = await params;
  const db = getDb();
  const [merchant] = await db
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
    .limit(1);
  if (!merchant) notFound();

  const venueSites = await db
    .select({
      id: sites.id,
      name: sites.name,
      slug: sites.slug,
      description: sites.description,
      city: sites.city,
      province: sites.province,
      amenities: sites.amenities,
      latitude: sites.latitude,
      longitude: sites.longitude,
      courtId: courts.id,
      hourlyRateCents: courts.baseHourlyRateCents,
      indoor: courts.indoor,
      coverUrl: sql<string | null>`case when ${sitePhotos.id} is null then null else '/api/venue-photos/site/' || ${sitePhotos.id}::text end`,
    })
    .from(sites)
    .leftJoin(courts, and(eq(courts.siteId, sites.id), eq(courts.status, "active")))
    .leftJoin(sitePhotos, and(eq(sitePhotos.siteId, sites.id), eq(sitePhotos.isCover, true)))
    .where(and(eq(sites.merchantId, merchant.id), eq(sites.status, "active")))
    .orderBy(asc(sites.name));

  const siteCards = Array.from(
    venueSites.reduce((map, row) => {
      const existing = map.get(row.id);
      if (existing) {
        if (row.courtId) {
          existing.courtCount += 1;
          existing.indoorCourtCount += row.indoor ? 1 : 0;
          existing.outdoorCourtCount += row.indoor ? 0 : 1;
          if (
            row.hourlyRateCents !== null &&
            (existing.startingRateCents === null ||
              row.hourlyRateCents < existing.startingRateCents)
          ) {
            existing.startingRateCents = row.hourlyRateCents;
          }
        }
      } else {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          city: row.city,
          province: row.province,
          amenities: row.amenities,
          latitude: row.latitude ? Number(row.latitude) : null,
          longitude: row.longitude ? Number(row.longitude) : null,
          courtCount: row.courtId ? 1 : 0,
          startingRateCents: row.hourlyRateCents,
          indoorCourtCount: row.courtId && row.indoor ? 1 : 0,
          outdoorCourtCount: row.courtId && !row.indoor ? 1 : 0,
          coverUrl: row.coverUrl,
        });
      }
      return map;
    }, new Map<string, { id: string; name: string; slug: string; description: string | null; city: string; province: string | null; amenities: string[]; latitude: number | null; longitude: number | null; courtCount: number; startingRateCents: number | null; indoorCourtCount: number; outdoorCourtCount: number; coverUrl: string | null }>()).values(),
  );

  if (siteCards.length === 1) redirect(`/${merchant.slug}/${siteCards[0].slug}`);
  const courtCount = siteCards.reduce((total, site) => total + site.courtCount, 0);
  const logoUrl = merchant.logoPathname ? merchant.logoUrl : null;
  const coverUrl = merchant.coverPathname ? merchant.coverUrl : null;

  return (
    <main className="min-h-screen bg-[#f7f5ed] text-[var(--ink)]">
      <a href="#locations" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-black focus:text-[var(--forest)]">Skip to locations</a>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <nav aria-label="Merchant page navigation" className="flex items-center gap-2">
            <Link href="/" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-bold text-[var(--forest)] transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] sm:inline-flex">All venues</Link>
            <Link href="/auth/sign-in?audience=customer&callbackURL=%2Fcustomer" className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--forest)] transition-colors duration-200 hover:border-[var(--forest)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]">Login</Link>
          </nav>
        </div>
      </header>

      <section className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <div className="relative mx-auto min-h-[38rem] max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--forest)] shadow-[0_28px_80px_rgb(23_60_42_/_20%)] sm:rounded-[2.5rem]">
          {coverUrl ? <Image src={coverUrl} alt={`${merchant.name} pickleball courts`} fill sizes="100vw" className="object-cover" priority /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_31_22_/_96%)_0%,rgb(8_31_22_/_82%)_44%,rgb(8_31_22_/_22%)_100%)]" />
          <div className="relative z-10 flex min-h-[38rem] max-w-3xl flex-col justify-end px-6 py-8 text-white sm:px-10 sm:py-12 lg:px-16 lg:py-16">
            {logoUrl ? <div className="relative mb-6 h-20 w-20 overflow-hidden rounded-2xl border border-white/30 bg-white shadow-lg sm:h-24 sm:w-24"><Image src={logoUrl} alt={`${merchant.name} logo`} fill sizes="96px" className="object-contain p-1.5" priority /></div> : null}
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--lime)]">Official booking page</p>
            <h1 className="display-type mt-4 max-w-2xl text-5xl font-black leading-[0.94] tracking-[-0.045em] sm:text-7xl lg:text-8xl">Play at {merchant.name}.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg">{merchant.description || "Choose a location, see live court availability, and book your next game in a few taps."}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#locations" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--lime)] px-6 text-sm font-black text-[var(--ink)] shadow-[0_5px_0_rgb(8_31_22_/_70%)] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transform-none">Choose a location</a>
              <span className="inline-flex min-h-12 items-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-bold text-white/90 backdrop-blur">Live schedules · Secure booking</span>
            </div>
            <dl className="mt-9 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur-md">
              <div className="p-4 sm:p-5"><dt className="text-[0.68rem] font-bold uppercase tracking-wider text-white/55">Locations</dt><dd className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">{siteCards.length}</dd></div>
              <div className="border-x border-white/15 p-4 sm:p-5"><dt className="text-[0.68rem] font-bold uppercase tracking-wider text-white/55">Courts</dt><dd className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">{courtCount}</dd></div>
              <div className="p-4 sm:p-5"><dt className="text-[0.68rem] font-bold uppercase tracking-wider text-white/55">Booking</dt><dd className="mt-2 text-xs font-black text-[var(--lime)] sm:text-sm">Real time</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section id="locations" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20">
        <MerchantSiteDirectory merchantSlug={merchant.slug} sites={siteCards} />

        {siteCards.length === 0 ? <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center"><p className="font-bold">No public sites are available yet.</p><p className="mt-2 text-sm text-[var(--text-muted)]">Check back after the merchant finishes venue setup.</p></div> : null}

        <div className="mt-14 grid gap-3 rounded-[2rem] border border-[var(--line)] bg-[#eff5d8] p-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["clock", "Live availability", "Court schedules update in real time."], ["calendar", "Easy booking", "Choose one hour or consecutive blocks."], ["shield", "Secure payments", "Online or verified manual options."], ["players", "For every player", "Guests and registered players welcome."]].map(([icon, title, copy]) => <article key={title} className="rounded-2xl bg-white/70 p-5"><FeatureIcon name={icon} /><h2 className="mt-4 text-sm font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{copy}</p></article>)}
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--paper)]"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-[var(--text-muted)] sm:px-8"><p>Powered by Pikko.ph</p><Link href="/" className="font-black text-[var(--forest)]">Discover more courts →</Link></div></footer>
    </main>
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
