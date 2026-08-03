import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  courtAllocations,
  courtOperatingHours,
  courts,
  merchants,
  priceRules,
  scheduleOverrides,
  siteOperatingHours,
  sites,
} from "@/db/schema";
import type { ManualPaymentOption } from "@/lib/manual-payment/options";
import { enabledManualPaymentOptions } from "@/lib/manual-payment/options";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
  rateCents: number;
};

export type AvailabilitySlotState =
  | "available"
  | "booked"
  | "held"
  | "blocked"
  | "closed"
  | "past"
  | "unavailable";

export type AvailabilityScheduleSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
  rateCents: number | null;
  state: AvailabilitySlotState;
};

export type CourtAvailability = {
  id: string;
  name: string;
  slug: string;
  indoor: boolean;
  surfaceType: string | null;
  baseHourlyRateCents: number;
  slots: AvailableSlot[];
  schedule: AvailabilityScheduleSlot[];
};

export type SiteAvailability = {
  merchant: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
    gatewayFeeBasisPoints: number;
  };
  site: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    addressLine1: string;
    city: string;
    province: string | null;
    latitude: string | null;
    longitude: string | null;
    timezone: string;
    contactEmail: string | null;
    amenities: string[];
    bookingLeadMinutes: number;
    advanceBookingDays: number;
    onlinePaymentEnabled: boolean;
    manualPaymentEnabled: boolean;
    manualReservationMode: "reserve_immediately" | "reserve_after_verification";
    manualPaymentDeadlineMinutes: number;
    manualPaymentInstructions: string | null;
    manualPaymentOptions: ManualPaymentOption[];
  };
  date: string;
  earliestDate: string;
  latestDate: string;
  courts: CourtAvailability[];
};

type Period = { opensAt: string; closesAt: string };

function dateParts(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function timeParts(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDateTimeToUtc(localDate: string, localTime: string, timezone: string) {
  const date = dateParts(localDate);
  if (!date) throw new Error("Invalid local date");
  const time = timeParts(localTime);
  const desired = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let candidate = new Date(desired);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(candidate, timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(candidate.getTime() + desired - represented);
  }

  return candidate;
}

function formatLocalDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(localDate: string, days: number) {
  const parts = dateParts(localDate);
  if (!parts) throw new Error("Invalid local date");
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return date.toISOString().slice(0, 10);
}

function formatSlotLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function overlaps(
  startsAt: Date,
  endsAt: Date,
  blockedStart: Date,
  blockedEnd: Date,
) {
  return startsAt < blockedEnd && endsAt > blockedStart;
}

function matchingRate(
  rules: Array<{
    courtId: string | null;
    type: "recurring" | "special_date" | "seasonal";
    dayOfWeek: number | null;
    specialDate: string | null;
    startsAt: string;
    endsAt: string;
    activeFrom: string | null;
    activeUntil: string | null;
    hourlyRateCents: number;
    priority: number;
    updatedAt: Date;
  }>,
  courtId: string,
  localDate: string,
  dayOfWeek: number,
  slotStartMinutes: number,
  slotEndMinutes: number,
  fallback: number,
) {
  const matches = rules
    .filter((rule) => {
      if (rule.courtId && rule.courtId !== courtId) return false;
      if (slotStartMinutes < timeParts(rule.startsAt).totalMinutes) return false;
      if (slotEndMinutes > timeParts(rule.endsAt).totalMinutes) return false;
      if (rule.activeFrom && localDate < rule.activeFrom) return false;
      if (rule.activeUntil && localDate > rule.activeUntil) return false;
      if (rule.type === "special_date") return rule.specialDate === localDate;
      if (rule.type === "recurring") return rule.dayOfWeek === dayOfWeek;
      return Boolean(
        rule.activeFrom &&
          rule.activeUntil &&
          localDate >= rule.activeFrom &&
          localDate <= rule.activeUntil,
      );
    })
    .sort((left, right) => {
      const specificity = (rule: (typeof rules)[number]) => {
        if (rule.type === "special_date") return rule.courtId ? 500 : 400;
        if (rule.type === "recurring") return rule.courtId ? 300 : 200;
        return rule.courtId ? 280 : 180;
      };
      return (
        specificity(right) - specificity(left) ||
        right.priority - left.priority ||
        right.updatedAt.getTime() - left.updatedAt.getTime()
      );
    });

  return matches[0]?.hourlyRateCents ?? fallback;
}

export async function getSiteAvailability(
  merchantSlug: string,
  siteSlug: string,
  requestedDate?: string,
): Promise<SiteAvailability | null> {
  const db = getDb();
  const [venue] = await db
    .select({
      merchantId: merchants.id,
      merchantName: merchants.displayName,
      merchantSlug: merchants.slug,
      merchantContactEmail: merchants.contactEmail,
      onlinePaymentsAllowed: merchants.onlinePaymentsAllowed,
      gatewayFeeBasisPoints: merchants.gatewayFeeBasisPoints,
      siteId: sites.id,
      siteName: sites.name,
      siteSlug: sites.slug,
      description: sites.description,
      addressLine1: sites.addressLine1,
      city: sites.city,
      province: sites.province,
      latitude: sites.latitude,
      longitude: sites.longitude,
      timezone: sites.timezone,
      siteContactEmail: sites.contactEmail,
      amenities: sites.amenities,
      bookingLeadMinutes: sites.bookingLeadMinutes,
      advanceBookingDays: sites.advanceBookingDays,
      onlinePaymentEnabled: sites.onlinePaymentEnabled,
      manualPaymentEnabled: sites.manualPaymentEnabled,
      manualReservationMode: sites.manualReservationMode,
      manualPaymentDeadlineMinutes: sites.manualPaymentDeadlineMinutes,
      manualPaymentInstructions: sites.manualPaymentInstructions,
      manualPaymentOptions: sites.manualPaymentOptions,
    })
    .from(sites)
    .innerJoin(merchants, eq(sites.merchantId, merchants.id))
    .where(
      and(
        eq(merchants.slug, merchantSlug),
        eq(merchants.status, "active"),
        eq(sites.slug, siteSlug),
        eq(sites.status, "active"),
      ),
    )
    .limit(1);

  if (!venue) return null;

  const now = new Date();
  const earliestDate = formatLocalDate(now, venue.timezone);
  const latestDate = addCalendarDays(earliestDate, venue.advanceBookingDays);
  const date =
    requestedDate &&
    dateParts(requestedDate) &&
    requestedDate >= earliestDate &&
    requestedDate <= latestDate
      ? requestedDate
      : earliestDate;
  const selectedDateParts = dateParts(date)!;
  const dayOfWeek = new Date(
    Date.UTC(selectedDateParts.year, selectedDateParts.month - 1, selectedDateParts.day),
  ).getUTCDay();
  const dayStart = localDateTimeToUtc(date, "00:00", venue.timezone);
  const nextDate = addCalendarDays(date, 1);
  const dayEnd = localDateTimeToUtc(nextDate, "00:00", venue.timezone);

  const courtRows = await db
    .select({
      id: courts.id,
      name: courts.name,
      slug: courts.slug,
      indoor: courts.indoor,
      surfaceType: courts.surfaceType,
      baseHourlyRateCents: courts.baseHourlyRateCents,
    })
    .from(courts)
    .where(
      and(
        eq(courts.merchantId, venue.merchantId),
        eq(courts.siteId, venue.siteId),
        eq(courts.status, "active"),
      ),
    )
    .orderBy(asc(courts.sortOrder), asc(courts.name));

  if (courtRows.length === 0) {
    return {
      merchant: {
        id: venue.merchantId,
        name: venue.merchantName,
        slug: venue.merchantSlug,
        contactEmail: venue.merchantContactEmail,
        gatewayFeeBasisPoints: venue.gatewayFeeBasisPoints,
      },
      site: {
        id: venue.siteId,
        name: venue.siteName,
        slug: venue.siteSlug,
        description: venue.description,
        addressLine1: venue.addressLine1,
        city: venue.city,
        province: venue.province,
        latitude: venue.latitude,
        longitude: venue.longitude,
        timezone: venue.timezone,
        contactEmail: venue.siteContactEmail,
        amenities: venue.amenities,
        bookingLeadMinutes: venue.bookingLeadMinutes,
        advanceBookingDays: venue.advanceBookingDays,
        onlinePaymentEnabled:
          venue.onlinePaymentsAllowed && venue.onlinePaymentEnabled,
        manualPaymentEnabled: venue.manualPaymentEnabled,
        manualReservationMode: venue.manualReservationMode,
        manualPaymentDeadlineMinutes: venue.manualPaymentDeadlineMinutes,
        manualPaymentInstructions: venue.manualPaymentInstructions,
        manualPaymentOptions: enabledManualPaymentOptions(
          venue.manualPaymentOptions,
        ),
      },
      date,
      earliestDate,
      latestDate,
      courts: [],
    };
  }

  const courtIds = courtRows.map((court) => court.id);
  const [siteHours, courtHours, overrides, allocations, rules] = await Promise.all([
    db
      .select({ opensAt: siteOperatingHours.opensAt, closesAt: siteOperatingHours.closesAt })
      .from(siteOperatingHours)
      .where(
        and(
          eq(siteOperatingHours.siteId, venue.siteId),
          eq(siteOperatingHours.dayOfWeek, dayOfWeek),
        ),
      )
      .orderBy(asc(siteOperatingHours.opensAt)),
    db
      .select({
        courtId: courtOperatingHours.courtId,
        opensAt: courtOperatingHours.opensAt,
        closesAt: courtOperatingHours.closesAt,
      })
      .from(courtOperatingHours)
      .where(
        and(
          inArray(courtOperatingHours.courtId, courtIds),
          eq(courtOperatingHours.dayOfWeek, dayOfWeek),
        ),
      )
      .orderBy(asc(courtOperatingHours.opensAt)),
    db
      .select({
        courtId: scheduleOverrides.courtId,
        isClosed: scheduleOverrides.isClosed,
        opensAt: scheduleOverrides.opensAt,
        closesAt: scheduleOverrides.closesAt,
      })
      .from(scheduleOverrides)
      .where(
        and(
          eq(scheduleOverrides.siteId, venue.siteId),
          eq(scheduleOverrides.localDate, date),
        ),
      )
      .orderBy(desc(scheduleOverrides.updatedAt)),
    db
      .select({
        courtId: courtAllocations.courtId,
        startsAt: courtAllocations.startsAt,
        endsAt: courtAllocations.endsAt,
        kind: courtAllocations.kind,
      })
      .from(courtAllocations)
      .where(
        and(
          inArray(courtAllocations.courtId, courtIds),
          eq(courtAllocations.active, true),
          lt(courtAllocations.startsAt, dayEnd),
          gt(courtAllocations.endsAt, dayStart),
          or(isNull(courtAllocations.expiresAt), gt(courtAllocations.expiresAt, now)),
        ),
      ),
    db
      .select({
        courtId: priceRules.courtId,
        type: priceRules.type,
        dayOfWeek: priceRules.dayOfWeek,
        specialDate: priceRules.specialDate,
        startsAt: priceRules.startsAt,
        endsAt: priceRules.endsAt,
        activeFrom: priceRules.activeFrom,
        activeUntil: priceRules.activeUntil,
        hourlyRateCents: priceRules.hourlyRateCents,
        priority: priceRules.priority,
        updatedAt: priceRules.updatedAt,
      })
      .from(priceRules)
      .where(and(eq(priceRules.siteId, venue.siteId), eq(priceRules.active, true))),
  ]);

  const siteOverride = overrides.find((override) => override.courtId === null);
  const leadThreshold = new Date(now.getTime() + venue.bookingLeadMinutes * 60_000);
  const periodsByCourt = new Map<string, Period[]>();

  for (const court of courtRows) {
    const courtOverride = overrides.find((override) => override.courtId === court.id);
    const weeklyCourtHours = courtHours.filter((hours) => hours.courtId === court.id);
    let periods: Period[];

    if (courtOverride) {
      periods =
        courtOverride.isClosed || !courtOverride.opensAt || !courtOverride.closesAt
          ? []
          : [{ opensAt: courtOverride.opensAt, closesAt: courtOverride.closesAt }];
    } else if (siteOverride) {
      periods =
        siteOverride.isClosed || !siteOverride.opensAt || !siteOverride.closesAt
          ? []
          : [{ opensAt: siteOverride.opensAt, closesAt: siteOverride.closesAt }];
    } else {
      periods = weeklyCourtHours.length > 0 ? weeklyCourtHours : siteHours;
    }

    periodsByCourt.set(court.id, periods);
  }

  const activePeriods = Array.from(periodsByCourt.values()).flat();
  const fallbackPeriods = [
    ...siteHours,
    ...courtHours.map(({ opensAt, closesAt }) => ({ opensAt, closesAt })),
  ];
  const gridPeriods = activePeriods.length > 0 ? activePeriods : fallbackPeriods;
  const gridOpens = gridPeriods.length
    ? Math.min(...gridPeriods.map((period) => timeParts(period.opensAt).totalMinutes))
    : null;
  const gridCloses = gridPeriods.length
    ? Math.max(...gridPeriods.map((period) => timeParts(period.closesAt).totalMinutes))
    : null;

  const availability = courtRows.map<CourtAvailability>((court) => {
    const periods = periodsByCourt.get(court.id) ?? [];

    const courtBlocks = allocations.filter((allocation) => allocation.courtId === court.id);
    const schedule: AvailabilityScheduleSlot[] = [];

    if (gridOpens !== null && gridCloses !== null) {
      for (let startMinute = gridOpens; startMinute + 60 <= gridCloses; startMinute += 60) {
        const startHour = Math.floor(startMinute / 60);
        const startMinutePart = startMinute % 60;
        const endMinute = startMinute + 60;
        const endHour = Math.floor(endMinute / 60);
        const endMinutePart = endMinute % 60;
        const startsAt = localDateTimeToUtc(
          date,
          `${String(startHour).padStart(2, "0")}:${String(startMinutePart).padStart(2, "0")}`,
          venue.timezone,
        );
        const endsAt = localDateTimeToUtc(
          endHour >= 24 ? nextDate : date,
          `${String(endHour % 24).padStart(2, "0")}:${String(endMinutePart).padStart(2, "0")}`,
          venue.timezone,
        );
        const withinOperatingHours = periods.some((period) => {
          const opens = timeParts(period.opensAt).totalMinutes;
          const closes = timeParts(period.closesAt).totalMinutes;
          return startMinute >= opens && endMinute <= closes;
        });
        const allocation = courtBlocks.find((block) =>
          overlaps(startsAt, endsAt, block.startsAt, block.endsAt),
        );
        const rateCents = withinOperatingHours
          ? matchingRate(
              rules,
              court.id,
              date,
              dayOfWeek,
              startMinute,
              endMinute,
              court.baseHourlyRateCents,
            )
          : null;
        let state: AvailabilitySlotState;

        if (!withinOperatingHours) state = "closed";
        else if (startsAt < now) state = "past";
        else if (allocation?.kind === "booking") state = "booked";
        else if (allocation?.kind === "checkout_hold") state = "held";
        else if (allocation?.kind === "merchant_block") state = "blocked";
        else if (startsAt < leadThreshold) state = "unavailable";
        else state = "available";

        schedule.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          label: formatSlotLabel(startsAt, venue.timezone),
          rateCents,
          state,
        });
      }
    }

    const slots = schedule
      .filter(
        (slot): slot is AvailabilityScheduleSlot & { rateCents: number } =>
          slot.state === "available" && slot.rateCents !== null,
      )
      .map(({ startsAt, endsAt, label, rateCents }) => ({
        startsAt,
        endsAt,
        label,
        rateCents,
      }));

    return { ...court, slots, schedule };
  });

  return {
    merchant: {
      id: venue.merchantId,
      name: venue.merchantName,
      slug: venue.merchantSlug,
      contactEmail: venue.merchantContactEmail,
      gatewayFeeBasisPoints: venue.gatewayFeeBasisPoints,
    },
    site: {
      id: venue.siteId,
      name: venue.siteName,
      slug: venue.siteSlug,
      description: venue.description,
      addressLine1: venue.addressLine1,
      city: venue.city,
      province: venue.province,
      latitude: venue.latitude,
      longitude: venue.longitude,
      timezone: venue.timezone,
      contactEmail: venue.siteContactEmail,
      amenities: venue.amenities,
      bookingLeadMinutes: venue.bookingLeadMinutes,
      advanceBookingDays: venue.advanceBookingDays,
      onlinePaymentEnabled:
        venue.onlinePaymentsAllowed && venue.onlinePaymentEnabled,
      manualPaymentEnabled: venue.manualPaymentEnabled,
      manualReservationMode: venue.manualReservationMode,
      manualPaymentDeadlineMinutes: venue.manualPaymentDeadlineMinutes,
      manualPaymentInstructions: venue.manualPaymentInstructions,
      manualPaymentOptions: enabledManualPaymentOptions(
        venue.manualPaymentOptions,
      ),
    },
    date,
    earliestDate,
    latestDate,
    courts: availability,
  };
}
