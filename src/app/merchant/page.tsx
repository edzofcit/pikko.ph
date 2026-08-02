import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
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
  const canOpenBookings = access.permissions.some(
    (permission) => permission === "manage_bookings",
  );
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
      booking.paymentStatus === "pending" ||
      booking.paymentStatus === "unpaid",
  ).length;
  const attentionBookings = recentBookings.filter(
    (booking) =>
      booking.status === "pending_verification" ||
      booking.paymentStatus === "pending" ||
      booking.paymentStatus === "unpaid",
  );

  return (
    <DashboardShell
      eyebrow={`Merchant workspace · ${access.membership.merchantName}`}
      title={`Welcome back, ${access.user.fullName}.`}
      description={`${role} access${siteNames ? ` for ${siteNames}` : ""}. Your role controls every dashboard page and server action.`}
      navigation={[
        { href: "/customer", label: "Customer mode" },
        { href: "/account/security", label: "Security" },
        ...(canOpenBookings
          ? [{ href: "/merchant/schedule", label: "Schedule" }]
          : []),
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/venues", label: "Sites & courts" }]
          : []),
        ...(canManageStaff ? [{ href: "/merchant/team", label: "Team" }] : []),
      ]}
      primaryAction={
        canOpenBookings
          ? { href: "/merchant/bookings/new", label: "+ Create booking" }
          : undefined
      }
      metrics={[
        { label: "Recent bookings", value: String(recentBookings.length), note: "Latest 20 assigned-site bookings" },
        { label: "Collected", value: formatPeso(paidTotalCents), note: "Paid bookings in this view" },
        { label: "Assigned sites", value: String(access.sites.length), note: siteNames || "No site assignment" },
        { label: "Needs attention", value: String(attentionCount), note: "Pending manual payments" },
      ]}
    >
      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Quick actions">
        {access.permissions.includes("manage_courts") ? (
          <Link
            href="/merchant/venues"
            className="group rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[var(--forest)]"
          >
            <span className="text-2xl" aria-hidden="true">◫</span>
            <h2 className="mt-3 font-black">Sites & courts</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Update rates, availability, and payment instructions.
            </p>
            <span className="mt-4 inline-flex text-xs font-black text-[var(--forest)]">Manage inventory →</span>
          </Link>
        ) : null}
        {canManageStaff ? (
          <Link
            href="/merchant/team"
            className="group rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[var(--forest)]"
          >
            <span className="text-2xl" aria-hidden="true">◎</span>
            <h2 className="mt-3 font-black">Team access</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Invite staff and control who can manage each site.
            </p>
            <span className="mt-4 inline-flex text-xs font-black text-[var(--forest)]">Manage team →</span>
          </Link>
        ) : null}
        <Link
          href={`/${access.membership.merchantSlug}`}
          className="group rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[var(--forest)]"
        >
          <span className="text-2xl" aria-hidden="true">↗</span>
          <h2 className="mt-3 font-black">Public booking page</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            See exactly what customers see before they book.
          </p>
          <span className="mt-4 inline-flex text-xs font-black text-[var(--forest)]">Open marketplace page →</span>
        </Link>
      </section>

      {attentionBookings.length ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">Action queue</p>
              <h2 className="mt-1 font-black text-amber-950">Payments waiting for review</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900">
              {attentionBookings.length} pending
            </span>
          </div>
          <div className="divide-y divide-amber-200">
            {attentionBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm">
                <div>
                  <p className="font-black">{booking.customerName ?? "Guest customer"}</p>
                  <p className="mt-1 text-xs text-amber-900/70">
                    {booking.reference} · {booking.siteName} · {formatPeso(booking.totalCents)}
                  </p>
                </div>
                {canOpenBookings ? (
                  <Link
                    href={`/merchant/bookings/${booking.id}`}
                    className="rounded-full bg-amber-950 px-4 py-2 text-xs font-black text-white"
                  >
                    Review payment
                  </Link>
                ) : (
                  <span className="text-xs font-bold text-amber-900">Awaiting authorized staff</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="font-bold">Recent bookings</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Newest reservations across your assigned sites</p>
          </div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {recentBookings.map((booking) => {
            const item = firstItemByBooking.get(booking.id);
            return (
              <div key={booking.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[0.8fr_1.1fr_1.2fr_1.15fr_0.6fr] sm:items-center">
                {canOpenBookings ? (
                  <Link
                    href={`/merchant/bookings/${booking.id}`}
                    className="font-mono text-xs font-bold text-[var(--forest)] underline decoration-[var(--lime)] decoration-2 underline-offset-4"
                  >
                    {booking.reference}
                  </Link>
                ) : (
                  <span className="font-mono text-xs font-bold">{booking.reference}</span>
                )}
                <span>
                  <span className="block font-semibold">{item?.courtName ?? booking.siteName}</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">{booking.customerName ?? "Guest customer"}</span>
                </span>
                <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                  {item
                    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(item.startsAt)
                    : booking.customerName ?? "Guest booking"}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <span className="w-fit rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]">
                    {booking.paymentStatus.replaceAll("_", " ")}
                  </span>
                  <span className="w-fit rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-bold text-[var(--text-muted)]">
                    {booking.status.replaceAll("_", " ")}
                  </span>
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
