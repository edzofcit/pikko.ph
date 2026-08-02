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
        if (row.courtId) existing.courtCount += 1;
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
          coverUrl: row.coverUrl,
        });
      }
      return map;
    }, new Map<string, { id: string; name: string; slug: string; description: string | null; city: string; province: string | null; amenities: string[]; latitude: number | null; longitude: number | null; courtCount: number; coverUrl: string | null }>()).values(),
  );

  if (siteCards.length === 1) redirect(`/${merchant.slug}/${siteCards[0].slug}`);
  const courtCount = siteCards.reduce((total, site) => total + site.courtCount, 0);
  const logoUrl = merchant.logoPathname ? merchant.logoUrl : null;
  const coverUrl = merchant.coverPathname ? merchant.coverUrl : null;

  return (
    <main className="min-h-screen bg-[#f7f5ed]">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <span className="rounded-full bg-[var(--mint)] px-3 py-1.5 text-xs font-bold text-[var(--forest)]">Public venue page</span>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto grid min-h-[30rem] max-w-7xl lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative z-10 flex flex-col justify-center px-5 py-14 sm:px-8 lg:py-20">
            {logoUrl ? <div className="relative mb-7 h-20 w-20 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm"><Image src={logoUrl} alt={`${merchant.name} logo`} fill sizes="80px" className="object-contain p-1" priority /></div> : null}
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--coral)]">Pickleball venues</p>
            <h1 className="display-type mt-4 max-w-xl text-5xl font-black sm:text-7xl">Play at {merchant.name}.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">{merchant.description || "Find your nearest location, compare courts, and book an available hourly slot in a few taps."}</p>
            <dl className="mt-9 flex flex-wrap gap-8">
              <div><dt className="text-xs font-bold text-[var(--text-muted)]">Locations</dt><dd className="mt-1 text-3xl font-black">{siteCards.length}</dd></div>
              <div className="border-l border-[var(--line)] pl-8"><dt className="text-xs font-bold text-[var(--text-muted)]">Courts</dt><dd className="mt-1 text-3xl font-black">{courtCount}</dd></div>
              <div className="border-l border-[var(--line)] pl-8"><dt className="text-xs font-bold text-[var(--text-muted)]">Booking</dt><dd className="mt-2 text-sm font-black text-[var(--forest)]">Live availability</dd></div>
            </dl>
          </div>
          <div className="relative min-h-72 bg-[var(--forest)] lg:min-h-full">
            {coverUrl ? <Image src={coverUrl} alt={`${merchant.name} courts`} fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" priority /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <MerchantSiteDirectory merchantSlug={merchant.slug} sites={siteCards} />

        {siteCards.length === 0 ? <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center"><p className="font-bold">No public sites are available yet.</p><p className="mt-2 text-sm text-[var(--text-muted)]">Check back after the merchant finishes venue setup.</p></div> : null}

        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {[ ["◷", "Live availability", "Real-time court schedules."], ["▣", "Easy booking", "Choose one or consecutive hours."], ["◇", "Secure payments", "Online or verified manual payments."], ["♙", "For everyone", "Guests and registered players welcome."] ].map(([icon, title, copy]) => <article key={title} className="bg-[#eff5d8] p-6"><span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--mint)] text-xl font-black text-[var(--forest)]">{icon}</span><h2 className="mt-4 text-sm font-black">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{copy}</p></article>)}
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--paper)]"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-[var(--text-muted)] sm:px-8"><p>Powered by Pikko.ph</p><Link href="/" className="font-black text-[var(--forest)]">Discover more courts →</Link></div></footer>
    </main>
  );
}
