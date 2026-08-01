import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { courts, merchants, sites } from "@/db/schema";

export const metadata: Metadata = { title: "Pickleball venues" };
export const dynamic = "force-dynamic";

export default async function PublicMerchantPage({
  params,
}: {
  params: Promise<{ merchantSlug: string }>;
}) {
  const { merchantSlug } = await params;
  const db = getDb();
  const [merchant] = await db
    .select({ id: merchants.id, name: merchants.displayName, slug: merchants.slug })
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
      courtId: courts.id,
    })
    .from(sites)
    .leftJoin(courts, and(eq(courts.siteId, sites.id), eq(courts.status, "active")))
    .where(and(eq(sites.merchantId, merchant.id), eq(sites.status, "active")))
    .orderBy(asc(sites.name));
  const siteCards = Array.from(
    venueSites.reduce(
      (map, row) => {
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
            courtCount: row.courtId ? 1 : 0,
          });
        }
        return map;
      },
      new Map<
        string,
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          city: string;
          province: string | null;
          courtCount: number;
        }
      >(),
    ).values(),
  );

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-lg font-black text-[var(--forest)]">
            Pikko.ph
          </Link>
          <span className="rounded-full bg-[var(--mint)] px-3 py-1.5 text-xs font-bold text-[var(--forest)]">
            Public venue page
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
          Pickleball venues
        </p>
        <h1 className="display-type mt-4 max-w-3xl text-5xl font-black sm:text-7xl">
          Play at {merchant.name}.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
          Choose a location to see its courts, real hourly availability, and current prices.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {siteCards.map((site) => (
            <Link
              key={site.id}
              href={`/${merchant.slug}/${site.slug}`}
              className="group rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_18px_60px_rgb(23_60_42_/_8%)] transition hover:-translate-y-1 hover:border-[var(--forest)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{site.name}</h2>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {site.city}{site.province ? `, ${site.province}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--lime)] px-3 py-1.5 text-xs font-black">
                  {site.courtCount} {site.courtCount === 1 ? "court" : "courts"}
                </span>
              </div>
              <p className="mt-6 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                {site.description || "View available court-hour blocks and choose your playing time."}
              </p>
              <p className="mt-6 text-sm font-black text-[var(--forest)] group-hover:underline">
                View availability →
              </p>
            </Link>
          ))}
        </div>

        {siteCards.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
            <p className="font-bold">No public sites are available yet.</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Check back after the merchant finishes venue setup.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
