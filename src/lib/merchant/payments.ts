import "server-only";

import { and, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingItems, bookings, courts, payments, sites } from "@/db/schema";

export type MerchantPaymentType = "online" | "manual" | "walk_in" | "complimentary";

export type MerchantPaymentFilters = {
  range: "daily" | "weekly" | "monthly" | "custom";
  from: string;
  to: string;
  site: string;
  paymentType: string;
  status: string;
  q: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_TYPES = new Set(["online", "manual", "walk_in"]);

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function startOfMonth(value: string) {
  return `${value.slice(0, 8)}01`;
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(value, -daysSinceMonday);
}

function dateSpan(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
}

export function normalizeMerchantPaymentFilters(
  today: string,
  query: Record<string, string | undefined>,
  allowedSiteIds: string[],
): MerchantPaymentFilters {
  const range = ["daily", "weekly", "monthly", "custom"].includes(query.range ?? "")
    ? query.range as MerchantPaymentFilters["range"]
    : "monthly";
  let from = today;
  let to = today;
  if (range === "weekly") {
    from = startOfWeek(today);
  } else if (range === "monthly") {
    from = startOfMonth(today);
  } else if (range === "custom") {
    from = query.from && DATE_PATTERN.test(query.from) ? query.from : today;
    to = query.to && DATE_PATTERN.test(query.to) ? query.to : from;
    if (to < from) [from, to] = [to, from];
    if (dateSpan(from, to) > 366) to = addDays(from, 365);
  }
  return {
    range,
    from,
    to,
    site: query.site && allowedSiteIds.includes(query.site) ? query.site : "",
    paymentType: PAYMENT_TYPES.has(query.paymentType ?? "") ? query.paymentType! : "",
    status: payments.status.enumValues.includes(query.status as typeof payments.status.enumValues[number]) ? query.status! : "",
    q: query.q?.trim().slice(0, 160) ?? "",
  };
}

export function classifyPaymentType(provider: string, method: string): MerchantPaymentType {
  if (method === "complimentary") return "complimentary";
  if (provider === "maya") return "online";
  if (provider === "manual") return "manual";
  return "walk_in";
}

export function formatPaymentType(type: MerchantPaymentType) {
  if (type === "walk_in") return "Walk-in";
  return type[0].toUpperCase() + type.slice(1);
}

export async function getMerchantPaymentDashboard({
  merchantId,
  siteIds,
  filters,
}: {
  merchantId: string;
  siteIds: string[];
  filters: MerchantPaymentFilters;
}) {
  if (!siteIds.length) return emptyPaymentDashboard(filters);
  const transactionTimestamp = sql`coalesce(${payments.paidAt}, ${payments.createdAt})`;
  const conditions: SQL[] = [
    eq(payments.merchantId, merchantId),
    inArray(bookings.siteId, filters.site ? [filters.site] : siteIds),
    gte(transactionTimestamp, new Date(`${filters.from}T00:00:00+08:00`)),
    lt(transactionTimestamp, new Date(`${addDays(filters.to, 1)}T00:00:00+08:00`)),
  ];
  if (filters.status) conditions.push(eq(payments.status, filters.status as typeof payments.status.enumValues[number]));
  if (filters.paymentType === "online") conditions.push(eq(payments.provider, "maya"));
  if (filters.paymentType === "manual") conditions.push(eq(payments.provider, "manual"));
  if (filters.paymentType === "walk_in") conditions.push(and(eq(payments.provider, "none"), eq(payments.method, "cash"))!);
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(or(
      ilike(payments.requestReference, pattern),
      ilike(bookings.reference, pattern),
      ilike(bookings.customerName, pattern),
      ilike(bookings.customerEmail, pattern),
      ilike(sites.name, pattern),
    )!);
  }

  const rows = await getDb()
    .select({
      id: payments.id,
      requestReference: payments.requestReference,
      providerReference: payments.providerReference,
      provider: payments.provider,
      method: payments.method,
      status: payments.status,
      amountCents: payments.amountCents,
      currency: payments.currency,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      bookingId: bookings.id,
      bookingReference: bookings.reference,
      bookingSource: bookings.source,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      siteId: sites.id,
      siteName: sites.name,
      courtName: courts.name,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .leftJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .leftJoin(courts, eq(courts.id, bookingItems.courtId))
    .where(and(...conditions))
    .orderBy(desc(transactionTimestamp));

  type PaymentTransaction = Omit<(typeof rows)[number], "courtName"> & {
    courtNames: string[];
    transactionAt: Date;
    paymentType: MerchantPaymentType;
  };
  const combined = new Map<string, PaymentTransaction>();
  for (const row of rows) {
    const existing = combined.get(row.id);
    if (existing) {
      if (row.courtName && !existing.courtNames.includes(row.courtName)) existing.courtNames.push(row.courtName);
      continue;
    }
    combined.set(row.id, {
      ...row,
      courtNames: row.courtName ? [row.courtName] : [],
      transactionAt: row.paidAt ?? row.createdAt,
      paymentType: classifyPaymentType(row.provider, row.method),
    });
  }
  const transactions = Array.from(combined.values()).sort((left, right) => right.transactionAt.getTime() - left.transactionAt.getTime());
  const successful = transactions.filter((transaction) => transaction.status === "paid" && transaction.paymentType !== "complimentary");
  const totalBookingSalesCents = successful.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const onlinePaymentsCents = successful.filter((transaction) => transaction.paymentType === "online").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const manualPaymentsCents = successful.filter((transaction) => transaction.paymentType === "manual").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const walkInPaymentsCents = successful.filter((transaction) => transaction.paymentType === "walk_in").reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const dailyByDate = new Map<string, { onlineCents: number; manualCents: number; walkInCents: number }>();
  for (let date = filters.from; date <= filters.to; date = addDays(date, 1)) dailyByDate.set(date, { onlineCents: 0, manualCents: 0, walkInCents: 0 });
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const transaction of successful) {
    const date = dateFormatter.format(transaction.transactionAt);
    const point = dailyByDate.get(date);
    if (!point) continue;
    if (transaction.paymentType === "online") point.onlineCents += transaction.amountCents;
    if (transaction.paymentType === "manual") point.manualCents += transaction.amountCents;
    if (transaction.paymentType === "walk_in") point.walkInCents += transaction.amountCents;
  }
  const daily = Array.from(dailyByDate, ([date, point]) => ({
    date,
    ...point,
    totalCents: point.onlineCents + point.manualCents + point.walkInCents,
  }));
  return { filters, transactions, daily, totalBookingSalesCents, onlinePaymentsCents, manualPaymentsCents, walkInPaymentsCents, refreshedAt: new Date() };
}

function emptyPaymentDashboard(filters: MerchantPaymentFilters) {
  return {
    filters,
    transactions: [],
    daily: [],
    totalBookingSalesCents: 0,
    onlinePaymentsCents: 0,
    manualPaymentsCents: 0,
    walkInPaymentsCents: 0,
    refreshedAt: new Date(),
  };
}
