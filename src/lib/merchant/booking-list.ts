import "server-only";

import { and, asc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingItems, bookings, courts, sites } from "@/db/schema";

export type MerchantBookingFilters = {
  site?: string;
  court?: string;
  from?: string;
  to?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  q?: string;
  tab?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function plusOneDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export async function getMerchantBookingList({
  merchantId,
  siteIds,
  filters,
  today,
}: {
  merchantId: string;
  siteIds: string[];
  filters: MerchantBookingFilters;
  today: string;
}) {
  if (!siteIds.length) return [];
  const conditions: SQL[] = [eq(bookings.merchantId, merchantId), inArray(bookings.siteId, siteIds)];
  if (filters.site && siteIds.includes(filters.site)) conditions.push(eq(bookings.siteId, filters.site));
  if (filters.court) conditions.push(eq(bookingItems.courtId, filters.court));
  if (filters.from && DATE_PATTERN.test(filters.from)) conditions.push(gte(bookingItems.startsAt, new Date(`${filters.from}T00:00:00+08:00`)));
  if (filters.to && DATE_PATTERN.test(filters.to)) conditions.push(lt(bookingItems.startsAt, new Date(`${plusOneDay(filters.to)}T00:00:00+08:00`)));
  if (filters.bookingStatus) conditions.push(eq(bookings.status, filters.bookingStatus as typeof bookings.status.enumValues[number]));
  if (filters.paymentStatus) conditions.push(eq(bookings.paymentStatus, filters.paymentStatus as typeof bookings.paymentStatus.enumValues[number]));
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(or(ilike(bookings.reference, pattern), ilike(bookings.customerName, pattern), ilike(bookings.customerEmail, pattern), ilike(bookings.customerMobileNumber, pattern))!);
  }

  const rows = await getDb()
    .select({
      id: bookings.id,
      reference: bookings.reference,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      customerMobileNumber: bookings.customerMobileNumber,
      siteId: bookings.siteId,
      siteName: sites.name,
      courtId: bookingItems.courtId,
      courtName: courts.name,
      indoor: courts.indoor,
      startsAt: bookingItems.startsAt,
      endsAt: bookingItems.endsAt,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      totalCents: bookings.totalCents,
      currency: bookings.currency,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(courts, eq(courts.id, bookingItems.courtId))
    .where(and(...conditions))
    .orderBy(asc(bookingItems.startsAt));

  const combined = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = combined.get(row.id);
    if (!existing) combined.set(row.id, { ...row });
    else if (row.endsAt > existing.endsAt) existing.endsAt = row.endsAt;
  }
  const todayStart = new Date(`${today}T00:00:00+08:00`);
  const tomorrowStart = new Date(`${plusOneDay(today)}T00:00:00+08:00`);
  const now = new Date();
  const tab = filters.tab ?? "all";
  return Array.from(combined.values())
    .filter((booking) => {
      if (tab === "upcoming") return booking.startsAt >= now && booking.status !== "cancelled";
      if (tab === "today") return booking.startsAt >= todayStart && booking.startsAt < tomorrowStart && booking.status !== "cancelled";
      if (tab === "past") return booking.endsAt < now && booking.status !== "cancelled";
      if (tab === "cancelled") return booking.status === "cancelled";
      return true;
    })
    .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());
}
