import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants, sites } from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { getMerchantReport, normalizeReportFilters } from "@/lib/merchant/reports";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET(request: Request) {
  const access = await getMerchantAccess();
  if (!access?.membership || !access.permissions.includes("view_dashboard")) return new Response("Unauthorized", { status: 401 });
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const [{ today }] = await getDb().select({ today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')` }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1);
  const allowedSiteIds = access.sites.map((site) => site.id);
  const filters = normalizeReportFilters(today, query, allowedSiteIds);
  const reportSites = allowedSiteIds.length ? await getDb().select({ id: sites.id, name: sites.name, slug: sites.slug, timezone: sites.timezone }).from(sites).where(and(eq(sites.merchantId, access.membership.merchantId), inArray(sites.id, allowedSiteIds))) : [];
  const report = await getMerchantReport({ merchantId: access.membership.merchantId, sites: reportSites, filters });
  const header = ["Transaction ID", "Date & Time", "Booking ID", "Customer", "Email", "Site", "Court", "Schedule Start", "Schedule End", "Timezone", "Payment Method", "Transaction Type", "Payment Status", "Booking Status", "Gross Amount PHP", "Refund PHP", "Net Collected PHP"];
  const body = report.transactions.filter((row) => !filters.day || new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(row.startsAt) === filters.day).map((row) => [row.transactionId, new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: row.timezone }).format(row.transactionAt), row.reference, row.customerName, row.customerEmail, row.siteName, row.courtNames.join(" / "), row.startsAt.toISOString(), row.endsAt.toISOString(), row.timezone, row.paymentMethod, row.transactionType, row.paymentStatus, row.bookingStatus, (row.grossCents / 100).toFixed(2), (row.refundCents / 100).toFixed(2), (row.collectedCents / 100).toFixed(2)]);
  const csv = [header, ...body].map((record) => record.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pikko-report-${filters.from}-to-${filters.to}.csv"`, "Cache-Control": "private, no-store" } });
}
