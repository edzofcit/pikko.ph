"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  coverUrl: string | null;
};

export function MerchantSiteDirectory({ merchantSlug, sites }: { merchantSlug: string; sites: SiteCard[] }) {
  const [query, setQuery] = useState("");
  const filteredSites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sites;
    return sites.filter((site) => [site.name, site.city, site.province, ...site.amenities].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query, sites]);

  if (!sites.length) return null;
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--coral)]">Choose a venue</p><h2 className="display-type mt-2 text-4xl font-black sm:text-5xl">Find your court.</h2></div>
        <label className="relative block w-full sm:max-w-md"><span className="sr-only">Search locations</span><span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations or amenities" className="w-full rounded-2xl border border-[var(--line)] bg-white py-3.5 pl-11 pr-4 text-sm shadow-sm" /></label>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredSites.map((site) => (
          <Link key={site.id} href={`/${merchantSlug}/${site.slug}`} className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_18px_60px_rgb(23_60_42_/_8%)] transition hover:-translate-y-1 hover:border-[var(--forest)]">
            <div className="relative aspect-[16/9] bg-[var(--forest)]">
              {site.coverUrl ? <Image src={site.coverUrl} alt={`${site.name} venue`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}
              <span className="absolute bottom-4 right-4 rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black text-[var(--ink)]">{site.courtCount} {site.courtCount === 1 ? "court" : "courts"}</span>
            </div>
            <div className="p-5">
              <h3 className="text-xl font-black">{site.name}</h3>
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">⌖ {site.city}{site.province ? `, ${site.province}` : ""}</p>
              {site.amenities.length ? <div className="mt-4 flex flex-wrap gap-2">{site.amenities.slice(0, 4).map((amenity) => <span key={amenity} className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-[0.68rem] font-bold text-[var(--forest)]">{amenity}</span>)}</div> : null}
              <p className="mt-5 border-t border-[var(--line)] pt-4 text-sm font-black text-[var(--forest)]">View availability →</p>
            </div>
          </Link>
        ))}
      </div>
      {!filteredSites.length ? <p className="mt-8 rounded-2xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm font-bold">No locations match “{query}”.</p> : null}
    </div>
  );
}
