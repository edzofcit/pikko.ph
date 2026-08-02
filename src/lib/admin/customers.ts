import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants, sites } from "@/db/schema";
import { getMerchantCustomers, type MerchantCustomer, type MerchantCustomerTransaction } from "@/lib/merchant/customers";

export type AdminCustomerTransaction = MerchantCustomerTransaction & { merchantId: string; merchantName: string };
export type AdminCustomer = Omit<MerchantCustomer, "transactions" | "siteIds" | "siteNames"> & {
  merchantIds: string[]; merchantNames: string[]; siteIds: string[]; siteNames: string[]; transactions: AdminCustomerTransaction[];
};

export async function getAdminCustomers() {
  const db = getDb();
  const [merchantRows, siteRows] = await Promise.all([
    db.select({ id: merchants.id, name: merchants.displayName }).from(merchants).orderBy(asc(merchants.displayName)),
    db.select({ id: sites.id, merchantId: sites.merchantId }).from(sites),
  ]);
  const batches = await Promise.all(merchantRows.map(async (merchant) => ({
    merchant,
    customers: await getMerchantCustomers({ merchantId: merchant.id, siteIds: siteRows.filter((site) => site.merchantId === merchant.id).map((site) => site.id) }),
  })));
  const merged = new Map<string, AdminCustomer>();
  for (const batch of batches) for (const customer of batch.customers) {
    const transactions = customer.transactions.map((transaction) => ({ ...transaction, merchantId: batch.merchant.id, merchantName: batch.merchant.name }));
    const existing = merged.get(customer.key);
    if (!existing) {
      merged.set(customer.key, { ...customer, merchantIds: [batch.merchant.id], merchantNames: [batch.merchant.name], transactions });
      continue;
    }
    existing.bookingCount += customer.bookingCount;
    existing.grossCents += customer.grossCents; existing.collectedCents += customer.collectedCents; existing.refundCents += customer.refundCents;
    existing.firstBookingAt = customer.firstBookingAt < existing.firstBookingAt ? customer.firstBookingAt : existing.firstBookingAt;
    existing.lastBookingAt = customer.lastBookingAt > existing.lastBookingAt ? customer.lastBookingAt : existing.lastBookingAt;
    if (customer.nextBookingAt && (!existing.nextBookingAt || customer.nextBookingAt < existing.nextBookingAt)) existing.nextBookingAt = customer.nextBookingAt;
    existing.activeInLast30Days ||= customer.activeInLast30Days;
    if (!existing.merchantIds.includes(batch.merchant.id)) { existing.merchantIds.push(batch.merchant.id); existing.merchantNames.push(batch.merchant.name); }
    for (let index = 0; index < customer.siteIds.length; index += 1) if (!existing.siteIds.includes(customer.siteIds[index])) { existing.siteIds.push(customer.siteIds[index]); existing.siteNames.push(customer.siteNames[index]); }
    existing.transactions.push(...transactions);
  }
  return Array.from(merged.values()).map((customer) => ({ ...customer, transactions: customer.transactions.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()) })).sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime());
}
