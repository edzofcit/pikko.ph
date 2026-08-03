import "server-only";

import type {
  AvailabilitySlotState,
  SiteAvailability,
} from "@/lib/booking/availability";
import { getSiteAvailability } from "@/lib/booking/availability";
import {
  getMarketplaceSites,
  type MarketplaceSite,
} from "@/lib/marketplace/courts";

export type LandingSlot = {
  startsAt: string;
  label: string;
  rateCents: number | null;
  state: AvailabilitySlotState;
};

export type LandingCourt = MarketplaceSite["courts"][number] & {
  availableSlotCount: number;
  previewSlots: LandingSlot[];
};

export type LandingMarketplaceSite = Omit<MarketplaceSite, "courts"> & {
  courts: LandingCourt[];
  availabilityDate: string | null;
  availableCourtCount: number;
  availableSlotCount: number;
  nextAvailableLabel: string | null;
  liveStartingRateCents: number;
};

function upcomingRows(availability: SiteAvailability) {
  const starts = Array.from(
    new Set(
      availability.courts.flatMap((court) =>
        court.schedule
          .filter((slot) => slot.state !== "past" && slot.state !== "closed")
          .map((slot) => slot.startsAt),
      ),
    ),
  )
    .sort()
    .slice(0, 4);

  return new Set(starts);
}

function enrichSite(
  site: MarketplaceSite,
  availability: SiteAvailability | null,
): LandingMarketplaceSite {
  if (!availability) {
    return {
      ...site,
      courts: site.courts.map((court) => ({
        ...court,
        availableSlotCount: 0,
        previewSlots: [],
      })),
      availabilityDate: null,
      availableCourtCount: 0,
      availableSlotCount: 0,
      nextAvailableLabel: null,
      liveStartingRateCents: site.startingRateCents,
    };
  }

  const previewStarts = upcomingRows(availability);
  const availabilityByCourt = new Map(
    availability.courts.map((court) => [court.id, court]),
  );
  const courts = site.courts.map<LandingCourt>((court) => {
    const liveCourt = availabilityByCourt.get(court.id);
    return {
      ...court,
      availableSlotCount: liveCourt?.slots.length ?? 0,
      previewSlots:
        liveCourt?.schedule
          .filter((slot) => previewStarts.has(slot.startsAt))
          .map(({ startsAt, label, rateCents, state }) => ({
            startsAt,
            label,
            rateCents,
            state,
          })) ?? [],
    };
  });
  const availableSlots = availability.courts
    .flatMap((court) => court.slots)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  return {
    ...site,
    courts,
    availabilityDate: availability.date,
    availableCourtCount: courts.filter((court) => court.availableSlotCount > 0)
      .length,
    availableSlotCount: availableSlots.length,
    nextAvailableLabel: availableSlots[0]?.label ?? null,
    liveStartingRateCents:
      availableSlots.length > 0
        ? Math.min(...availableSlots.map((slot) => slot.rateCents))
        : site.startingRateCents,
  };
}

export async function getLandingMarketplace(
  requestedDate?: string,
): Promise<LandingMarketplaceSite[]> {
  const sites = await getMarketplaceSites();
  const availability = await Promise.all(
    sites.map((site) =>
      getSiteAvailability(site.merchantSlug, site.slug, requestedDate),
    ),
  );

  return sites.map((site, index) => enrichSite(site, availability[index]));
}
