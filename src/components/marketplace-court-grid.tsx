import Link from "next/link";
import type { MarketplaceSite } from "@/lib/marketplace/courts";
import { formatPeso } from "@/lib/money";

export function MarketplaceCourtGrid({ sites }: { sites: MarketplaceSite[] }) {
  if (sites.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
        <p className="text-lg font-black">Marketplace courts are coming soon.</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Active merchant sites with bookable courts will appear here automatically.
        </p>
        <Link
          href="/merchant"
          className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white"
        >
          List your venue
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {sites.map((site) => {
        const location = `${site.city}${site.province ? `, ${site.province}` : ""}`;
        const indoorCount = site.courts.filter((court) => court.indoor).length;

        return (
          <Link
            key={site.id}
            href={`/${site.merchantSlug}/${site.slug}`}
            className="group flex min-h-80 flex-col rounded-[1.75rem] border border-[var(--line)] bg-white p-6 shadow-[0_18px_55px_rgb(23_34_26_/_7%)] transition hover:-translate-y-1 hover:border-[var(--forest)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--coral)]">
                  {site.merchantName}
                </p>
                <h3 className="mt-2 text-2xl font-black">{site.name}</h3>
                <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                  {location}
                </p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-lg font-black transition group-hover:translate-x-0.5">
                ↗
              </span>
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
                <p className="text-xs text-[var(--text-muted)]">
                  {site.courts.length} {site.courts.length === 1 ? "court" : "courts"}
                  {indoorCount > 0 ? ` · ${indoorCount} indoor` : " · Outdoor"}
                </p>
                <p className="mt-1 text-lg font-black text-[var(--forest)]">
                  From {formatPeso(site.startingRateCents)}/hr
                </p>
              </div>
              <span className="text-sm font-black text-[var(--forest)] group-hover:underline">
                View slots
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
