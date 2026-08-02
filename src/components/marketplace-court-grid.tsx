import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { MarketplaceSite } from "@/lib/marketplace/courts";
import { formatPeso } from "@/lib/money";

export function MarketplaceCourtGrid({
  sites,
  date,
  filtered = false,
}: {
  sites: MarketplaceSite[];
  date?: string;
  filtered?: boolean;
}) {
  if (sites.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
        <p className="text-lg font-black">
          {filtered ? "No courts match those filters." : "Marketplace courts are coming soon."}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {filtered
            ? "Try another city, court type, or a broader search."
            : "Active merchant sites with bookable courts will appear here automatically."}
        </p>
        <Link
          href={filtered ? "/#courts" : "/merchant"}
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--forest)] px-5 text-sm font-black text-white"
        >
          {filtered ? "Clear filters" : "List your venue"}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {sites.map((site) => {
        const location = `${site.city}${site.province ? `, ${site.province}` : ""}`;
        const indoorCount = site.courts.filter((court) => court.indoor).length;

        return (
          <Link
            key={site.id}
            href={`/${site.merchantSlug}/${site.slug}${date ? `?date=${date}` : ""}`}
            className="group flex min-h-80 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-white shadow-[0_18px_55px_rgb(23_34_26_/_7%)] transition duration-200 hover:-translate-y-1 hover:border-[var(--forest)] hover:shadow-[0_22px_65px_rgb(23_60_42_/_13%)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--forest)] motion-reduce:transform-none"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[var(--forest)]">
              {site.coverUrl ? <Image src={site.coverUrl} alt={`${site.name} pickleball venue`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transform-none" /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#315f43,#173c2a)]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
              <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">{indoorCount > 0 && indoorCount < site.courts.length ? "Indoor & outdoor" : indoorCount > 0 ? "Indoor courts" : "Outdoor courts"}</span>
              <span className="absolute bottom-4 right-4 rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black text-[var(--ink)]">{site.courts.length} {site.courts.length === 1 ? "court" : "courts"}</span>
            </div>
            <div className="flex flex-1 flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral)]">
                  {site.merchantName}
                </p>
                <h3 className="mt-2 text-2xl font-black">{site.name}</h3>
                <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-[var(--text-muted)]"><span className="mt-0.5 shrink-0 text-[var(--forest)]"><GridIcon name="location" /></span>{location}</p>
              </div>
            </div>

            <p className="mt-5 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
              {site.description ||
                "Choose from live hourly court availability and current venue pricing."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {site.courts.slice(0, 3).map((court) => (
                <span
                  key={court.id}
                  className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-bold text-[var(--forest)]"
                >
                  {court.name}
                </span>
              ))}
              {site.courts.length > 3 ? (
                <span className="rounded-full bg-[var(--cream)] px-3 py-1.5 text-xs font-bold text-[var(--text-muted)]">
                  +{site.courts.length - 3} more
                </span>
              ) : null}
            </div>

            <div className="mt-auto flex items-end justify-between gap-4 border-t border-[var(--line)] pt-5">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Starts at</p>
                <p className="mt-1 text-lg font-black text-[var(--forest)]">
                  {formatPeso(site.startingRateCents)}<span className="text-xs font-bold text-[var(--text-muted)]"> / hour</span>
                </p>
              </div>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--forest)] px-4 text-xs font-black text-white transition-colors group-hover:bg-[var(--ink)]">View slots <GridIcon name="arrow" /></span>
            </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function GridIcon({ name }: { name: "arrow" | "location" }) {
  const paths: Record<"arrow" | "location", ReactNode> = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
