import "server-only";

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import {
  auditEvents,
  courts,
  merchants,
  merchantSubscriptions,
  subscriptionInvoices,
} from "@/db/schema";

const MAX_CATCH_UP_PERIODS = 24;

function formatBillingDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addMonths(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function dueAt(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);
  return new Date(date.getTime() + 7 * 24 * 60 * 60 * 1_000);
}

function invoiceNumber(merchantId: string, periodStart: string) {
  return `PKI-${periodStart.replaceAll("-", "")}-${merchantId.slice(0, 8).toUpperCase()}`;
}

export async function processSubscriptionBilling(options?: {
  merchantId?: string;
  actorUserId?: string;
  now?: Date;
}) {
  const db = getDb();
  const now = options?.now ?? new Date();
  const today = formatBillingDate(now);
  await db
    .update(subscriptionInvoices)
    .set({ status: "past_due", updatedAt: now })
    .where(and(eq(subscriptionInvoices.status, "issued"), lt(subscriptionInvoices.dueAt, now)));
  const merchantBaseRows = await db
    .select({
      id: merchants.id,
      displayName: merchants.displayName,
      subscriptionStatus: merchants.subscriptionStatus,
      trialEndsAt: merchants.trialEndsAt,
      monthlyCourtPriceCents: merchants.monthlyCourtPriceCents,
    })
    .from(merchants)
    .where(
      options?.merchantId
        ? eq(merchants.id, options.merchantId)
        : inArray(merchants.subscriptionStatus, ["trialing", "active"]),
    );

  const activeCourtCountRows = merchantBaseRows.length
    ? await db
        .select({
          merchantId: courts.merchantId,
          count: sql<number>`count(*)::int`.mapWith(Number),
        })
        .from(courts)
        .where(
          and(
            inArray(courts.merchantId, merchantBaseRows.map((merchant) => merchant.id)),
            eq(courts.status, "active"),
          ),
        )
        .groupBy(courts.merchantId)
    : [];
  const activeCourtCounts = new Map(
    activeCourtCountRows.map((row) => [row.merchantId, row.count]),
  );
  const merchantRows = merchantBaseRows.map((merchant) => ({
    ...merchant,
    activeCourtCount: activeCourtCounts.get(merchant.id) ?? 0,
  }));

  if (!merchantRows.length) {
    return { merchantsProcessed: 0, invoicesCreated: 0, trialsConverted: 0 };
  }

  const subscriptionRows = await db
    .select({
      merchantId: merchantSubscriptions.merchantId,
      currentPeriodStart: merchantSubscriptions.currentPeriodStart,
      currentPeriodEnd: merchantSubscriptions.currentPeriodEnd,
    })
    .from(merchantSubscriptions)
    .where(inArray(merchantSubscriptions.merchantId, merchantRows.map((merchant) => merchant.id)))
    .orderBy(desc(merchantSubscriptions.currentPeriodEnd));
  const latestSubscriptionByMerchant = new Map<
    string,
    (typeof subscriptionRows)[number]
  >();
  for (const subscription of subscriptionRows) {
    if (!latestSubscriptionByMerchant.has(subscription.merchantId)) {
      latestSubscriptionByMerchant.set(subscription.merchantId, subscription);
    }
  }

  let invoicesCreated = 0;
  let trialsConverted = 0;
  let merchantsProcessed = 0;

  for (const merchant of merchantRows) {
    const trialEndDate = formatBillingDate(merchant.trialEndsAt);
    const trialIsDue =
      merchant.subscriptionStatus === "trialing" &&
      merchant.trialEndsAt.getTime() <= now.getTime();
    const paidSubscription = merchant.subscriptionStatus === "active";
    if (!trialIsDue && !paidSubscription) continue;

    let periodStart = latestSubscriptionByMerchant.get(merchant.id)?.currentPeriodEnd;
    if (!periodStart) periodStart = trialIsDue ? trialEndDate : today;
    if (periodStart > today) continue;

    if (trialIsDue) {
      await db.batch([
        db
          .update(merchants)
          .set({ subscriptionStatus: "active", updatedAt: now })
          .where(and(eq(merchants.id, merchant.id), eq(merchants.subscriptionStatus, "trialing"))),
        db.insert(auditEvents).values({
          merchantId: merchant.id,
          actorUserId: options?.actorUserId ?? null,
          action: "platform.subscription.trial_converted",
          targetType: "merchant",
          targetId: merchant.id,
          before: { subscriptionStatus: "trialing", trialEndsAt: merchant.trialEndsAt },
          after: { subscriptionStatus: "active", convertedAt: now },
          metadata: { automated: !options?.actorUserId },
        }),
      ]);
      trialsConverted += 1;
    }

    let generatedForMerchant = 0;
    while (periodStart <= today && generatedForMerchant < MAX_CATCH_UP_PERIODS) {
      const periodEnd = addMonths(periodStart, 1);
      const subtotalCents = merchant.activeCourtCount * merchant.monthlyCourtPriceCents;
      const subscriptionId = randomUUID();
      const invoiceId = randomUUID();
      const number = invoiceNumber(merchant.id, periodStart);

      const [insertedInvoice] = await db
        .insert(subscriptionInvoices)
        .values({
          id: invoiceId,
          merchantId: merchant.id,
          invoiceNumber: number,
          status: "issued",
          periodStart,
          periodEnd,
          courtCount: merchant.activeCourtCount,
          subtotalCents,
          taxCents: 0,
          totalCents: subtotalCents,
          issuedAt: now,
          dueAt: dueAt(periodStart),
        })
        .onConflictDoNothing()
        .returning({ id: subscriptionInvoices.id });

      await db
        .insert(merchantSubscriptions)
        .values({
          id: subscriptionId,
          merchantId: merchant.id,
          status: "active",
          monthlyCourtPriceCents: merchant.monthlyCourtPriceCents,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        })
        .onConflictDoNothing();

      if (insertedInvoice) {
        await db.insert(auditEvents).values({
          merchantId: merchant.id,
          actorUserId: options?.actorUserId ?? null,
          action: "platform.subscription.invoice_issued",
          targetType: "subscription_invoice",
          targetId: invoiceId,
          after: {
            invoiceNumber: number,
            periodStart,
            periodEnd,
            courtCount: merchant.activeCourtCount,
            monthlyCourtPriceCents: merchant.monthlyCourtPriceCents,
            totalCents: subtotalCents,
          },
          metadata: { automated: !options?.actorUserId },
        });
        invoicesCreated += 1;
      }

      generatedForMerchant += 1;
      periodStart = periodEnd;
    }
    merchantsProcessed += 1;
  }

  return { merchantsProcessed, invoicesCreated, trialsConverted };
}
