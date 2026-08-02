import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountButton } from "@/components/account-button";
import { Brand } from "@/components/brand";
import { getDb } from "@/db";
import {
  bookingItems,
  bookings,
  courts,
  merchantMemberships,
  merchants,
  sites,
} from "@/db/schema";
import { syncCurrentUser } from "@/lib/auth/access";
import { ensureCustomerProfile } from "@/lib/customer/profile";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My bookings" };

function formatSchedule(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function CustomerPage() {
  const user = await syncCurrentUser();

  if (!user) {
    redirect(
      `/auth/sign-in?audience=customer&callbackURL=${encodeURIComponent("/customer")}`,
    );
  }

  const db = getDb();
  const membershipPromise = db
    .select({
      merchantName: merchants.displayName,
    })
    .from(merchantMemberships)
    .innerJoin(merchants, eq(merchants.id, merchantMemberships.merchantId))
    .where(
      and(
        eq(merchantMemberships.userId, user.id),
        eq(merchantMemberships.status, "active"),
        eq(merchants.status, "active"),
      ),
    )
    .orderBy(asc(merchantMemberships.createdAt))
    .limit(1);
  const [[membership], customerProfile] = await Promise.all([
    membershipPromise,
    ensureCustomerProfile(user),
  ]);
  const customerBookings = await db
    .select({
      id: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      totalCents: bookings.totalCents,
      createdAt: bookings.createdAt,
      merchantName: merchants.displayName,
      siteName: sites.name,
      timezone: sites.timezone,
    })
    .from(bookings)
    .innerJoin(
      sites,
      and(
        eq(sites.id, bookings.siteId),
        eq(sites.merchantId, bookings.merchantId),
      ),
    )
    .innerJoin(merchants, eq(merchants.id, bookings.merchantId))
    .where(
      user.emailVerifiedAt
        ? or(
            eq(bookings.customerId, customerProfile.id),
            sql`lower(${bookings.customerEmail}) = ${user.email}`,
          )
        : eq(bookings.customerId, customerProfile.id),
    )
    .orderBy(desc(bookings.createdAt))
    .limit(20);
  const bookingIds = customerBookings.map((booking) => booking.id);
  const items = bookingIds.length
    ? await db
        .select({
          bookingId: bookingItems.bookingId,
          startsAt: bookingItems.startsAt,
          courtName: courts.name,
        })
        .from(bookingItems)
        .innerJoin(courts, eq(courts.id, bookingItems.courtId))
        .where(inArray(bookingItems.bookingId, bookingIds))
        .orderBy(asc(bookingItems.startsAt))
    : [];
  const scheduleByBooking = new Map<
    string,
    { startsAt: Date; courtName: string; slotCount: number }
  >();

  for (const item of items) {
    const existing = scheduleByBooking.get(item.bookingId);
    if (existing) {
      existing.slotCount += 1;
    } else {
      scheduleByBooking.set(item.bookingId, {
        startsAt: item.startsAt,
        courtName: item.courtName,
        slotCount: 1,
      });
    }
  }

  const pendingCount = customerBookings.filter(
    (booking) =>
      booking.status === "pending_payment" ||
      booking.status === "pending_verification",
  ).length;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Brand />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--mint)] px-3 py-2 text-xs font-black text-[var(--forest)]">
              Customer mode
            </span>
            {membership ? (
              <Link
                href="/merchant"
                className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--forest)]"
              >
                Merchant portal
              </Link>
            ) : (
              <Link
                href="/merchant/onboarding"
                className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black text-[var(--forest)]"
              >
                List a venue
              </Link>
            )}
            <AccountButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-7 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">
              Customer account
            </p>
            <h1 className="display-type mt-3 text-5xl font-black sm:text-7xl">
              Hi, {user.fullName}.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
              Review bookings made while signed in, plus guest bookings associated with your verified email.
            </p>
          </div>
          <Link
            href="/#courts"
            className="inline-flex justify-center rounded-full bg-[var(--forest)] px-6 py-3.5 text-sm font-black text-white"
          >
            Find another court
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Bookings", String(customerBookings.length)],
            ["Needs action", String(pendingCount)],
            ["Account email", user.email],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {label}
              </p>
              <p className="mt-2 break-all text-xl font-black text-[var(--forest)]">
                {value}
              </p>
            </div>
          ))}
        </div>

        {!user.emailVerifiedAt ? (
          <p className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
            Verify your email to also claim earlier guest bookings made with this address.
          </p>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-xl font-black">My recent bookings</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Signed-in bookings{user.emailVerifiedAt ? ` and guest bookings made with ${user.email}` : " linked directly to this account"}
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {customerBookings.map((booking) => {
              const schedule = scheduleByBooking.get(booking.id);
              return (
                <article
                  key={booking.id}
                  className="grid gap-3 px-6 py-5 sm:grid-cols-[0.8fr_1.2fr_1.4fr_0.8fr] sm:items-center"
                >
                  <div>
                    <Link
                      href={`/booking/${booking.reference}`}
                      className="font-mono text-xs font-black text-[var(--forest)] underline decoration-[var(--lime)] decoration-2 underline-offset-4"
                    >
                      {booking.reference}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{booking.merchantName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-black">{schedule?.courtName ?? booking.siteName}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {schedule
                        ? `${formatSchedule(schedule.startsAt, booking.timezone)} · ${schedule.slotCount} ${schedule.slotCount === 1 ? "hour" : "hours"}`
                        : booking.siteName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-black text-[var(--forest)]">
                      {booking.status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black text-[var(--text-muted)]">
                      {booking.paymentStatus.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="font-black sm:text-right">{formatPeso(booking.totalCents)}</p>
                </article>
              );
            })}
            {customerBookings.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="font-black">No bookings linked to this account yet.</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Book while signed in and your reservations will appear here automatically.
                </p>
                <Link
                  href="/#courts"
                  className="mt-6 inline-flex rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-black text-[var(--ink)]"
                >
                  Browse marketplace courts
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
