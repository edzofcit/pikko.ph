import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import { bookingItems, bookings, courts, sites } from "@/db/schema";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { getMerchantAccess } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Merchant dashboard" };

export const dynamic = "force-dynamic";

export default async function MerchantPage() {
  const access = await getMerchantAccess();

  if (!access?.user) {
    return null;
  }

  if (!access.membership) {
    redirect("/merchant/onboarding");
  }

  const role = formatMerchantRole(access.membership.role);
  const siteNames = access.sites.map((site) => site.name).join(", ");
  const canManageStaff = access.permissions.includes("manage_staff");
  const siteIds = access.sites.map((site) => site.id);
  const db = getDb();
  const recentBookings = siteIds.length
    ? await db
        .select({
          id: bookings.id,
          reference: bookings.reference,
          siteName: sites.name,
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
          totalCents: bookings.totalCents,
          customerName: bookings.customerName,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(sites, eq(sites.id, bookings.siteId))
        .where(inArray(bookings.siteId, siteIds))
        .orderBy(desc(bookings.createdAt))
        .limit(20)
    : [];
  const bookingIds = recentBookings.map((booking) => booking.id);
  const recentItems = bookingIds.length
    ? await db
        .select({
          bookingId: bookingItems.bookingId,
          startsAt: bookingItems.startsAt,
          courtName: courts.name,
        })
        .from(bookingItems)
        .innerJoin(courts, eq(courts.id, bookingItems.courtId))
        .where(inArray(bookingItems.bookingId, bookingIds))
        .orderBy(bookingItems.startsAt)
    : [];
  const firstItemByBooking = new Map<string, (typeof recentItems)[number]>();
  for (const item of recentItems) {
    if (!firstItemByBooking.has(item.bookingId)) {
      firstItemByBooking.set(item.bookingId, item);
    }
  }
  const paidTotalCents = recentBookings
    .filter((booking) => booking.paymentStatus === "paid")
    .reduce((total, booking) => total + booking.totalCents, 0);
  const attentionCount = recentBookings.filter(
    (booking) =>
      booking.status === "pending_verification" ||
      booking.paymentStatus === "pending",
  ).length;

  return (
    <DashboardShell
      eyebrow={`Merchant workspace · ${access.membership.merchantName}`}
      title={`Welcome back, ${access.user.fullName}.`}
      description={`${role} access${siteNames ? ` for ${siteNames}` : ""}. Your role controls every dashboard page and server action.`}
      navigation={[
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/venues", label: "Sites & courts" }]
          : []),
        ...(canManageStaff ? [{ href: "/merchant/team", label: "Team" }] : []),
      ]}
      metrics={[
        { label: "Recent bookings", value: String(recentBookings.length), note: "Latest 20 assigned-site bookings" },
        { label: "Collected", value: formatPeso(paidTotalCents), note: "Paid bookings in this view" },
        { label: "Assigned sites", value: String(access.sites.length), note: siteNames || "No site assignment" },
        { label: "Needs attention", value: String(attentionCount), note: "Pending manual payments" },
      ]}
    >
      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="font-bold">Recent bookings</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Live bookings from assigned sites</p>
          </div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {recentBookings.map((booking) => {
            const item = firstItemByBooking.get(booking.id);
            return (
              <div key={booking.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[0.8fr_1.1fr_1.2fr_1fr_0.6fr] sm:items-center">
                <span className="font-mono text-xs font-bold">{booking.reference}</span>
                <span className="font-semibold">{item?.courtName ?? booking.siteName}</span>
                <span className="text-[var(--text-muted)]">
                  {item
                    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(item.startsAt)
                    : booking.customerName ?? "Guest booking"}
                </span>
                <span className="w-fit rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]">
                  {booking.paymentStatus.replaceAll("_", " ")}
                </span>
                <span className="font-bold sm:text-right">{formatPeso(booking.totalCents)}</span>
              </div>
            );
          })}
          {recentBookings.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
              No bookings yet. Enable manual payment for a site to test guest checkout.
            </p>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
