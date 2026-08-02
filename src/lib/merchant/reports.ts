import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, lt, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bookingItems,
  bookings,
  courtAllocations,
  courtBlocks,
  courtOperatingHours,
  courts,
  payments,
  refunds,
  scheduleOverrides,
  siteOperatingHours,
  sites,
} from "@/db/schema";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RANGE_DAYS = 366;
const REPORT_BOOKING_STATUSES = new Set(["confirmed", "completed"]);
const BOOKING_STATUSES = new Set(["draft", "pending_payment", "pending_verification", "confirmed", "cancelled", "expired", "completed", "no_show"]);
const PAYMENT_STATUSES = new Set(["unpaid", "pending", "paid", "rejected", "failed", "partially_refunded", "refunded"]);
const TRANSACTION_TYPES = new Set(["booking", "refund", "complimentary"]);

export type ReportQuery = Record<string, string | undefined>;
export type ReportFilters = {
  range: "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
  from: string;
  to: string;
  site: string;
  court: string;
  paymentStatus: string;
  bookingStatus: string;
  transactionType: string;
  q: string;
  day: string;
};

export type ReportTransaction = {
  bookingId: string;
  transactionId: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  siteId: string;
  siteName: string;
  courtIds: string[];
  courtNames: string[];
  transactionAt: Date;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  paymentMethod: string;
  transactionType: "booking" | "refund" | "complimentary";
  paymentStatus: string;
  bookingStatus: string;
  grossCents: number;
  refundCents: number;
  collectedCents: number;
  pendingCents: number;
  paymentCount: number;
  allocationHours: number;
  allocationPeriods: Array<{ courtId: string; startsAt: Date; endsAt: Date }>;
};

type ReportSite = { id: string; name: string; slug: string; timezone: string };

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function monthStart(value: string) { return `${value.slice(0, 7)}-01`; }

function resolveDates(today: string, query: ReportQuery) {
  const requested = query.range;
  const range = new Set(["today", "yesterday", "this_week", "this_month", "last_month", "custom"]).has(requested ?? "") ? requested as ReportFilters["range"] : "this_month";
  if (range === "today") return { range, from: today, to: today };
  if (range === "yesterday") { const date = addDays(today, -1); return { range, from: date, to: date }; }
  if (range === "this_week") {
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    return { range, from: addDays(today, -(day === 0 ? 6 : day - 1)), to: today };
  }
  if (range === "last_month") {
    const currentStart = monthStart(today);
    const previousEnd = addDays(currentStart, -1);
    return { range, from: monthStart(previousEnd), to: previousEnd };
  }
  if (range === "custom") {
    let from = DATE.test(query.from ?? "") ? query.from! : monthStart(today);
    let to = DATE.test(query.to ?? "") ? query.to! : today;
    if (from > to) [from, to] = [to, from];
    if (daysBetween(from, to) >= MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS - 1);
    return { range, from, to };
  }
  return { range: "this_month" as const, from: monthStart(today), to: today };
}

export function normalizeReportFilters(today: string, query: ReportQuery, allowedSiteIds: string[]): ReportFilters {
  const dates = resolveDates(today, query);
  return {
    ...dates,
    site: allowedSiteIds.includes(query.site ?? "") ? query.site! : "",
    court: UUID.test(query.court ?? "") ? query.court! : "",
    paymentStatus: PAYMENT_STATUSES.has(query.paymentStatus ?? "") ? query.paymentStatus! : "",
    bookingStatus: BOOKING_STATUSES.has(query.bookingStatus ?? "") ? query.bookingStatus! : "",
    transactionType: TRANSACTION_TYPES.has(query.transactionType ?? "") ? query.transactionType! : "",
    q: String(query.q ?? "").trim().slice(0, 160),
    day: DATE.test(query.day ?? "") && query.day! >= dates.from && query.day! <= dates.to ? query.day! : "",
  };
}

function formatLocalDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function localDateTimeToUtc(localDate: string, minutes: number, timezone: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const desired = Date.UTC(year, month - 1, day + Math.floor(hour / 24), hour % 24, minute);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(candidate, timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate = new Date(candidate.getTime() + desired - represented);
  }
  return candidate;
}

function overlaps(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function paymentMethodLabel(methods: string[]) {
  const labels: Record<string, string> = { maya_qrph: "Maya QRPH", manual_bank_transfer: "Manual bank transfer", manual_ewallet: "Manual e-wallet", cash: "Cash", complimentary: "Complimentary" };
  return Array.from(new Set(methods)).map((method) => labels[method] ?? method.replaceAll("_", " ")).join(", ") || "No payment";
}

export async function getMerchantReport({ merchantId, sites: reportSites, filters }: { merchantId: string; sites: ReportSite[]; filters: ReportFilters }) {
  const siteIds = reportSites.map((site) => site.id);
  const visibleSiteIds = filters.site ? [filters.site] : siteIds;
  if (!visibleSiteIds.length) return emptyReport(filters);
  const broadStart = new Date(`${addDays(filters.from, -1)}T00:00:00Z`);
  const broadEnd = new Date(`${addDays(filters.to, 2)}T00:00:00Z`);
  const db = getDb();
  const baseConditions: SQL[] = [eq(bookings.merchantId, merchantId), inArray(bookings.siteId, visibleSiteIds), lt(bookingItems.startsAt, broadEnd), gt(bookingItems.endsAt, broadStart)];
  if (filters.court) baseConditions.push(eq(bookingItems.courtId, filters.court));

  const itemRows = await db.select({
    bookingId: bookings.id, reference: bookings.reference, source: bookings.source, customerName: bookings.customerName, customerEmail: bookings.customerEmail,
    siteId: bookings.siteId, siteName: sites.name, timezone: sites.timezone, courtId: courts.id, courtName: courts.name,
    startsAt: bookingItems.startsAt, endsAt: bookingItems.endsAt, bookingStatus: bookings.status, paymentStatus: bookings.paymentStatus,
    totalCents: bookings.totalCents, bookingCreatedAt: bookings.createdAt, allocationActive: courtAllocations.active,
  }).from(bookings)
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(courts, eq(courts.id, bookingItems.courtId))
    .leftJoin(courtAllocations, and(eq(courtAllocations.bookingItemId, bookingItems.id), eq(courtAllocations.active, true)))
    .where(and(...baseConditions)).orderBy(asc(bookingItems.startsAt));

  const inLocalRange = itemRows.filter((row) => {
    const localDate = formatLocalDate(row.startsAt, row.timezone);
    return localDate >= filters.from && localDate <= filters.to;
  });
  const bookingIds = Array.from(new Set(inLocalRange.map((row) => row.bookingId)));
  const [paymentRows, refundRows] = bookingIds.length ? await Promise.all([
    db.select({ id: payments.id, bookingId: payments.bookingId, requestReference: payments.requestReference, method: payments.method, status: payments.status, amountCents: payments.amountCents, paidAt: payments.paidAt, createdAt: payments.createdAt }).from(payments).where(and(eq(payments.merchantId, merchantId), inArray(payments.bookingId, bookingIds))).orderBy(desc(payments.createdAt)),
    db.select({ bookingId: refunds.bookingId, status: refunds.status, amountCents: refunds.amountCents }).from(refunds).where(and(eq(refunds.merchantId, merchantId), inArray(refunds.bookingId, bookingIds))),
  ]) : [[], []];

  const paymentsByBooking = new Map<string, typeof paymentRows>();
  for (const payment of paymentRows) paymentsByBooking.set(payment.bookingId, [...(paymentsByBooking.get(payment.bookingId) ?? []), payment]);
  const refundsByBooking = new Map<string, typeof refundRows>();
  for (const refund of refundRows) refundsByBooking.set(refund.bookingId, [...(refundsByBooking.get(refund.bookingId) ?? []), refund]);

  const combined = new Map<string, ReportTransaction>();
  for (const row of inLocalRange) {
    const existing = combined.get(row.bookingId);
    if (existing) {
      if (!existing.courtIds.includes(row.courtId)) { existing.courtIds.push(row.courtId); existing.courtNames.push(row.courtName); }
      if (row.startsAt < existing.startsAt) existing.startsAt = row.startsAt;
      if (row.endsAt > existing.endsAt) existing.endsAt = row.endsAt;
      if (row.allocationActive) {
        existing.allocationHours += (row.endsAt.getTime() - row.startsAt.getTime()) / 3_600_000;
        existing.allocationPeriods.push({ courtId: row.courtId, startsAt: row.startsAt, endsAt: row.endsAt });
      }
      continue;
    }
    const bookingPayments = paymentsByBooking.get(row.bookingId) ?? [];
    const primaryPayment = bookingPayments.find((payment) => ["paid", "partially_refunded", "refunded"].includes(payment.status)) ?? bookingPayments[0];
    const recordedRefundCents = (refundsByBooking.get(row.bookingId) ?? []).filter((refund) => refund.status === "completed").reduce((sum, refund) => sum + refund.amountCents, 0);
    const completedRefundCents = row.paymentStatus === "refunded" ? Math.max(recordedRefundCents, row.totalCents) : recordedRefundCents;
    const successfulCents = bookingPayments.filter((payment) => ["paid", "partially_refunded", "refunded"].includes(payment.status)).reduce((sum, payment) => sum + payment.amountCents, 0);
    const transactionType = row.source === "merchant_complimentary" ? "complimentary" : completedRefundCents > 0 ? "refund" : "booking";
    combined.set(row.bookingId, {
      bookingId: row.bookingId, transactionId: primaryPayment?.requestReference ?? row.reference, reference: row.reference,
      customerName: row.customerName ?? "Guest", customerEmail: row.customerEmail ?? "", siteId: row.siteId, siteName: row.siteName,
      courtIds: [row.courtId], courtNames: [row.courtName], transactionAt: primaryPayment?.paidAt ?? primaryPayment?.createdAt ?? row.bookingCreatedAt, startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone,
      paymentMethod: paymentMethodLabel(bookingPayments.map((payment) => payment.method)), transactionType,
      paymentStatus: row.paymentStatus, bookingStatus: row.bookingStatus, grossCents: row.totalCents, refundCents: completedRefundCents,
      collectedCents: Math.max(0, successfulCents - completedRefundCents), pendingCents: ["unpaid", "pending", "rejected", "failed"].includes(row.paymentStatus) ? row.totalCents : 0,
      paymentCount: bookingPayments.length, allocationHours: row.allocationActive ? (row.endsAt.getTime() - row.startsAt.getTime()) / 3_600_000 : 0,
      allocationPeriods: row.allocationActive ? [{ courtId: row.courtId, startsAt: row.startsAt, endsAt: row.endsAt }] : [],
    });
  }

  const normalizedQuery = filters.q.toLowerCase();
  const transactions = Array.from(combined.values()).filter((transaction) => {
    if (filters.paymentStatus && transaction.paymentStatus !== filters.paymentStatus) return false;
    if (filters.bookingStatus && transaction.bookingStatus !== filters.bookingStatus) return false;
    if (filters.transactionType && transaction.transactionType !== filters.transactionType) return false;
    if (normalizedQuery && ![transaction.transactionId, transaction.reference, transaction.customerName, transaction.customerEmail, transaction.siteName, ...transaction.courtNames].some((value) => value.toLowerCase().includes(normalizedQuery))) return false;
    return true;
  }).sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());

  const utilization = await calculateUtilization({ merchantId, sites: reportSites.filter((site) => visibleSiteIds.includes(site.id)), filters, transactions });
  const qualifying = transactions.filter((transaction) => REPORT_BOOKING_STATUSES.has(transaction.bookingStatus) && transaction.paymentStatus !== "refunded" && transaction.refundCents < transaction.grossCents);
  const grossBookingValueCents = qualifying.reduce((sum, transaction) => sum + transaction.grossCents, 0);
  const collectedPaymentsCents = transactions.reduce((sum, transaction) => sum + transaction.collectedCents, 0);
  const pendingPaymentsCents = transactions.reduce((sum, transaction) => sum + transaction.pendingCents, 0);
  const daily = Array.from({ length: daysBetween(filters.from, filters.to) + 1 }, (_, index) => {
    const date = addDays(filters.from, index);
    const rows = transactions.filter((transaction) => formatLocalDate(transaction.startsAt, transaction.timezone) === date);
    const dayQualifying = rows.filter((transaction) => REPORT_BOOKING_STATUSES.has(transaction.bookingStatus) && transaction.paymentStatus !== "refunded" && transaction.refundCents < transaction.grossCents);
    return { date, grossCents: dayQualifying.reduce((sum, transaction) => sum + transaction.grossCents, 0), collectedCents: rows.reduce((sum, transaction) => sum + transaction.collectedCents, 0), bookingCount: rows.length };
  });
  return {
    filters, transactions, daily, grossBookingValueCents, collectedPaymentsCents, pendingPaymentsCents,
    totalBookings: transactions.length, averageBookingValueCents: qualifying.length ? Math.round(grossBookingValueCents / qualifying.length) : 0,
    utilizationPercent: utilization.availableHours ? Math.round((utilization.utilizedHours / utilization.availableHours) * 1000) / 10 : 0,
    utilizedHours: utilization.utilizedHours, availableHours: utilization.availableHours, refreshedAt: new Date(),
  };
}

async function calculateUtilization({ merchantId, sites: reportSites, filters, transactions }: { merchantId: string; sites: ReportSite[]; filters: ReportFilters; transactions: ReportTransaction[] }) {
  if (!reportSites.length) return { availableHours: 0, utilizedHours: 0 };
  const db = getDb();
  const siteIds = reportSites.map((site) => site.id);
  const broadStart = new Date(`${addDays(filters.from, -1)}T00:00:00Z`);
  const broadEnd = new Date(`${addDays(filters.to, 2)}T00:00:00Z`);
  const courtConditions: SQL[] = [eq(courts.merchantId, merchantId), inArray(courts.siteId, siteIds), eq(courts.status, "active")];
  if (filters.court) courtConditions.push(eq(courts.id, filters.court));
  const [courtRows, siteHours, courtHours, overrides, blocks] = await Promise.all([
    db.select({ id: courts.id, siteId: courts.siteId }).from(courts).where(and(...courtConditions)),
    db.select({ siteId: siteOperatingHours.siteId, dayOfWeek: siteOperatingHours.dayOfWeek, opensAt: siteOperatingHours.opensAt, closesAt: siteOperatingHours.closesAt }).from(siteOperatingHours).where(inArray(siteOperatingHours.siteId, siteIds)),
    db.select({ courtId: courtOperatingHours.courtId, dayOfWeek: courtOperatingHours.dayOfWeek, opensAt: courtOperatingHours.opensAt, closesAt: courtOperatingHours.closesAt }).from(courtOperatingHours).innerJoin(courts, eq(courts.id, courtOperatingHours.courtId)).where(and(eq(courts.merchantId, merchantId), inArray(courts.siteId, siteIds))),
    db.select({ siteId: scheduleOverrides.siteId, courtId: scheduleOverrides.courtId, localDate: scheduleOverrides.localDate, isClosed: scheduleOverrides.isClosed, opensAt: scheduleOverrides.opensAt, closesAt: scheduleOverrides.closesAt, updatedAt: scheduleOverrides.updatedAt }).from(scheduleOverrides).where(and(eq(scheduleOverrides.merchantId, merchantId), inArray(scheduleOverrides.siteId, siteIds), lt(scheduleOverrides.localDate, addDays(filters.to, 1)), gt(scheduleOverrides.localDate, addDays(filters.from, -1)))).orderBy(desc(scheduleOverrides.updatedAt)),
    db.select({ courtId: courtBlocks.courtId, type: courtBlocks.type, startsAt: courtBlocks.startsAt, endsAt: courtBlocks.endsAt }).from(courtBlocks).where(and(eq(courtBlocks.merchantId, merchantId), isNull(courtBlocks.cancelledAt), lt(courtBlocks.startsAt, broadEnd), gt(courtBlocks.endsAt, broadStart))),
  ]);
  const siteById = new Map(reportSites.map((site) => [site.id, site]));
  const siteHoursByDay = new Map<string, typeof siteHours>();
  for (const hours of siteHours) {
    const key = `${hours.siteId}:${hours.dayOfWeek}`;
    siteHoursByDay.set(key, [...(siteHoursByDay.get(key) ?? []), hours]);
  }
  const courtHoursByDay = new Map<string, typeof courtHours>();
  for (const hours of courtHours) {
    const key = `${hours.courtId}:${hours.dayOfWeek}`;
    courtHoursByDay.set(key, [...(courtHoursByDay.get(key) ?? []), hours]);
  }
  const latestSiteOverride = new Map<string, (typeof overrides)[number]>();
  const latestCourtOverride = new Map<string, (typeof overrides)[number]>();
  for (const override of overrides) {
    const map = override.courtId ? latestCourtOverride : latestSiteOverride;
    const key = `${override.courtId ?? override.siteId}:${override.localDate}`;
    if (!map.has(key)) map.set(key, override);
  }
  const blocksByCourt = new Map<string, typeof blocks>();
  for (const block of blocks) blocksByCourt.set(block.courtId, [...(blocksByCourt.get(block.courtId) ?? []), block]);
  const allocationsByCourt = new Map<string, ReportTransaction["allocationPeriods"]>();
  for (const transaction of transactions) {
    for (const period of transaction.allocationPeriods) allocationsByCourt.set(period.courtId, [...(allocationsByCourt.get(period.courtId) ?? []), period]);
  }
  let availableHours = 0;
  let utilizedHours = 0;
  for (let date = filters.from; date <= filters.to; date = addDays(date, 1)) {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const court of courtRows) {
      const site = siteById.get(court.siteId);
      if (!site) continue;
      const courtOverride = latestCourtOverride.get(`${court.id}:${date}`);
      const siteOverride = latestSiteOverride.get(`${court.siteId}:${date}`);
      const weeklyCourt = courtHoursByDay.get(`${court.id}:${dayOfWeek}`) ?? [];
      let periods: Array<{ opensAt: string; closesAt: string }>;
      const override = courtOverride ?? siteOverride;
      if (override) periods = override.isClosed || !override.opensAt || !override.closesAt ? [] : [{ opensAt: override.opensAt, closesAt: override.closesAt }];
      else periods = weeklyCourt.length ? weeklyCourt : siteHoursByDay.get(`${court.siteId}:${dayOfWeek}`) ?? [];
      const slots = new Map<number, { startsAt: Date; endsAt: Date }>();
      for (const period of periods) {
        const opens = timeMinutes(period.opensAt); const closes = timeMinutes(period.closesAt);
        for (let minute = opens; minute + 60 <= closes; minute += 60) slots.set(minute, { startsAt: localDateTimeToUtc(date, minute, site.timezone), endsAt: localDateTimeToUtc(date, minute + 60, site.timezone) });
      }
      const courtBlockRows = blocksByCourt.get(court.id) ?? [];
      const bookedPeriods = allocationsByCourt.get(court.id) ?? [];
      for (const slot of slots.values()) {
        const unavailable = courtBlockRows.some((block) => block.type !== "private_event" && overlaps(slot.startsAt, slot.endsAt, block.startsAt, block.endsAt));
        if (unavailable) continue;
        availableHours += 1;
        const privateEvent = courtBlockRows.some((block) => block.type === "private_event" && overlaps(slot.startsAt, slot.endsAt, block.startsAt, block.endsAt));
        const hasBooking = bookedPeriods.some((period) => overlaps(slot.startsAt, slot.endsAt, period.startsAt, period.endsAt));
        if (privateEvent || hasBooking) utilizedHours += 1;
      }
    }
  }
  return { availableHours, utilizedHours };
}

function emptyReport(filters: ReportFilters) {
  return { filters, transactions: [] as ReportTransaction[], daily: [] as Array<{ date: string; grossCents: number; collectedCents: number; bookingCount: number }>, grossBookingValueCents: 0, collectedPaymentsCents: 0, pendingPaymentsCents: 0, totalBookings: 0, averageBookingValueCents: 0, utilizationPercent: 0, utilizedHours: 0, availableHours: 0, refreshedAt: new Date() };
}
