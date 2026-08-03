import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { getMerchantBookingList } from "@/lib/merchant/booking-list";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const access = await getMerchantAccess();
  if (!access?.membership || !access.permissions.includes("manage_bookings")) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  const siteIds = access.sites.map((site) => site.id);
  const [{ today }] = await getDb().select({ today: sql<string>`to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')` }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1);
  const rows = await getMerchantBookingList({ merchantId: access.membership.merchantId, siteIds, filters, today });
  const header = ["Booking ID", "Customer", "Email", "Phone", "Site", "Court", "Start", "End", "Timezone", "Payment Type", "Payment Status", "Booking Status", "Amount", "Currency"];
  const body = rows.map((row) => [row.reference, row.customerName, row.customerEmail, row.customerMobileNumber, row.siteName, row.courtName, row.startsAt.toISOString(), row.endsAt.toISOString(), "Asia/Manila", row.paymentType, row.paymentStatus, row.status, (row.totalCents / 100).toFixed(2), row.currency]);
  const csv = [header, ...body].map((record) => record.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pikko-bookings-${today}.csv"` } });
}
