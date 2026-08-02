import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { courts, merchants, sitePhotos, sites } from "@/db/schema";

export type MarketplaceSite = {
  id: string;
  name: string;
  slug: string;
  merchantName: string;
  merchantSlug: string;
  description: string | null;
  city: string;
  province: string | null;
  amenities: string[];
  coverUrl: string | null;
  courts: Array<{
    id: string;
    name: string;
    indoor: boolean;
    surfaceType: string | null;
    hourlyRateCents: number;
  }>;
  startingRateCents: number;
};

export async function getMarketplaceSites(): Promise<MarketplaceSite[]> {
  const db = getDb();
  const rows = await db
    .select({
      siteId: sites.id,
      siteName: sites.name,
      siteSlug: sites.slug,
      description: sites.description,
      city: sites.city,
      province: sites.province,
      amenities: sites.amenities,
      coverUrl: sql<string | null>`case when ${sitePhotos.id} is null then null else '/api/venue-photos/site/' || ${sitePhotos.id}::text end`,
      merchantName: merchants.displayName,
      merchantSlug: merchants.slug,
      courtId: courts.id,
      courtName: courts.name,
      indoor: courts.indoor,
      surfaceType: courts.surfaceType,
      hourlyRateCents: courts.baseHourlyRateCents,
    })
    .from(courts)
    .innerJoin(
      sites,
      and(
        eq(sites.id, courts.siteId),
        eq(sites.merchantId, courts.merchantId),
      ),
    )
    .innerJoin(merchants, eq(merchants.id, sites.merchantId))
    .leftJoin(
      sitePhotos,
      and(eq(sitePhotos.siteId, sites.id), eq(sitePhotos.isCover, true)),
    )
    .where(
      and(
        eq(merchants.status, "active"),
        eq(sites.status, "active"),
        eq(courts.status, "active"),
      ),
    )
    .orderBy(
      asc(merchants.displayName),
      asc(sites.name),
      asc(courts.sortOrder),
      asc(courts.name),
    );

  const marketplace = new Map<string, MarketplaceSite>();

  for (const row of rows) {
    const existing = marketplace.get(row.siteId);
    const court = {
      id: row.courtId,
      name: row.courtName,
      indoor: row.indoor,
      surfaceType: row.surfaceType,
      hourlyRateCents: row.hourlyRateCents,
    };

    if (existing) {
      existing.courts.push(court);
      existing.startingRateCents = Math.min(
        existing.startingRateCents,
        row.hourlyRateCents,
      );
      continue;
    }

    marketplace.set(row.siteId, {
      id: row.siteId,
      name: row.siteName,
      slug: row.siteSlug,
      merchantName: row.merchantName,
      merchantSlug: row.merchantSlug,
      description: row.description,
      city: row.city,
      province: row.province,
      amenities: row.amenities,
      coverUrl: row.coverUrl,
      courts: [court],
      startingRateCents: row.hourlyRateCents,
    });
  }

  return Array.from(marketplace.values());
}
