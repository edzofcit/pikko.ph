"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatPeso } from "@/lib/money";

type SiteCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  province: string | null;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  courtCount: number;
  startingRateCents: number | null;
  indoorCourtCount: number;
  outdoorCourtCount: number;
  coverUrl: string | null;
};

type DirectoryIconName = "arrow" | "court" | "location" | "search";

export function MerchantSiteDirectory({ merchantSlug, sites }: { merchantSlug: string; sites: SiteCard[] }) {
  const [query, setQuery] = useState("");
  const filteredSites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sites;
    return sites.filter((site) =>
      [site.name, site.city, site.province, ...site.amenities]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, sites]);

  const quickFilters = useMemo(
    () => Array.from(new Set(sites.map((site) => site.city).filter(Boolean))).slice(0, 4),
    [sites],
  );

  if (!sites.length) return null;

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(22rem,1.2fr)] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--coral)]">Choose a venue</p>
          <h2 className="display-type mt-2 text-4xl font-black tracking-[-0.035em] sm:text-5xl">Find your next court.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">Compare locations, starting rates, and court types before checking live hourly availability.</p>
        </div>

        <div>
          <label htmlFor="merchant-site-search" className="mb-2 block text-sm font-black text-[var(--forest)]">Search locations</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--forest)]"><DirectoryIcon name="search" /></span>
            <input
              id="merchant-site-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try a city, venue, or amenity"
              className="min-h-14 w-full rounded-2xl border border-[var(--line)] bg-white py-3 pl-12 pr-4 text-base font-semibold shadow-[0_10px_30px_rgb(23_60_42_/_7%)] outline-none transition duration-200 placeholder:font-normal placeholder:text-[var(--text-muted)] focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--mint)]"
            />
          </div>
          {quickFilters.length > 1 ? <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Quick location filters"><span className="text-xs font-bold text-[var(--text-muted)]">Quick search:</span>{quickFilters.map((city) => <button key={city} type="button" onClick={() => setQuery(city)} className="min-h-10 rounded-full border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--forest)] transition-colors hover:border-[var(--forest)] hover:bg-[var(--mint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]">{city}</button>)}</div> : null}
        </div>
      </div>

      <p className="mt-8 text-sm font-bold text-[var(--text-muted)]" aria-live="polite">{filteredSites.length} {filteredSites.length === 1 ? "location" : "locations"} available</p>

      <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredSites.map((site) => {
          const courtType = site.indoorCourtCount && site.outdoorCourtCount
            ? "Indoor & outdoor"
            : site.indoorCourtCount
              ? "Indoor courts"
              : site.outdoorCourtCount
                ? "Outdoor courts"
                : null;

          return (
            <Link key={site.id} href={`/${merchantSlug}/${site.slug}`} className="group flex overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white shadow-[0_18px_55px_rgb(23_60_42_/_8%)] transition duration-200 hover:-translate-y-1 hover:border-[var(--forest)] hover:shadow-[0_22px_65px_rgb(23_60_42_/_14%)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--forest)] motion-reduce:transform-none">
              <article className="flex min-w-0 flex-1 flex-col">
                <div className="relative aspect-[16/10] overflow-hidden bg-[var(--forest)]">
                  {site.coverUrl ? <Image src={site.coverUrl} alt={`${site.name} pickleball venue`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                  {courtType ? <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">{courtType}</span> : null}
                  <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black text-[var(--ink)]"><DirectoryIcon name="court" />{site.courtCount} {site.courtCount === 1 ? "court" : "courts"}</span>
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-xl font-black tracking-[-0.02em] sm:text-2xl">{site.name}</h3>
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--text-muted)]"><span className="mt-0.5 shrink-0 text-[var(--forest)]"><DirectoryIcon name="location" /></span><span>{site.city}{site.province ? `, ${site.province}` : ""}</span></p>
                  {site.description ? <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">{site.description}</p> : null}

                  {site.amenities.length ? <div className="mt-4 flex flex-wrap gap-2">{site.amenities.slice(0, 3).map((amenity) => <span key={amenity} className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-[0.7rem] font-bold text-[var(--forest)]">{amenity}</span>)}{site.amenities.length > 3 ? <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-[0.7rem] font-bold text-[var(--text-muted)]">+{site.amenities.length - 3}</span> : null}</div> : null}

                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-[var(--line)] pt-5" style={{ marginTop: site.description || site.amenities.length ? "1.25rem" : "2rem" }}>
                    <div>{site.startingRateCents !== null ? <><p className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Starts at</p><p className="mt-0.5 font-black text-[var(--forest)]">{formatPeso(site.startingRateCents)}<span className="text-xs font-bold text-[var(--text-muted)]"> / hour</span></p></> : <p className="text-sm font-bold text-[var(--text-muted)]">See venue rates</p>}</div>
                    <span className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--forest)] px-4 text-xs font-black text-white transition-colors group-hover:bg-[var(--ink)]">View slots <DirectoryIcon name="arrow" /></span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      {!filteredSites.length ? <div className="mt-6 rounded-3xl border border-dashed border-[var(--line)] bg-white p-8 text-center"><p className="font-black">No locations match “{query}”.</p><p className="mt-2 text-sm text-[var(--text-muted)]">Try another city, venue name, or amenity.</p><button type="button" onClick={() => setQuery("")} className="mt-5 min-h-11 rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)]">Clear search</button></div> : null}
    </div>
  );
}

function DirectoryIcon({ name }: { name: DirectoryIconName }) {
  const paths: Record<DirectoryIconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    court: <><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M12 5v14M4 12h16" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
