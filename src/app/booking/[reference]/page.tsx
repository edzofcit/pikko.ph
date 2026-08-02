import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookingItems,
  bookings,
  courts,
  merchants,
  sites,
} from "@/db/schema";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function formatDateTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function GuestBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const token = query.token ?? "";
  if (!token || token.length > 1000) notFound();

  const db = getDb();
  const [booking] = await db
    .select({
      id: bookings.id,
      merchantId: bookings.merchantId,
      reference: bookings.reference,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      currency: bookings.currency,
      subtotalCents: bookings.subtotalCents,
      totalCents: bookings.totalCents,
      paymentDueAt: bookings.paymentDueAt,
      createdAt: bookings.createdAt,
      merchantName: merchants.displayName,
      merchantSlug: merchants.slug,
      siteName: sites.name,
      siteSlug: sites.slug,
      timezone: sites.timezone,
      manualReservationMode: sites.manualReservationMode,
      manualPaymentInstructions: sites.manualPaymentInstructions,
    })
    .from(bookingAccessTokens)
    .innerJoin(
      bookings,
      and(
        eq(bookings.id, bookingAccessTokens.bookingId),
        eq(bookings.merchantId, bookingAccessTokens.merchantId),
      ),
    )
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .innerJoin(merchants, eq(merchants.id, bookings.merchantId))
    .where(
      and(
        eq(bookings.reference, reference),
        eq(bookingAccessTokens.tokenHash, hashToken(token)),
        gt(bookingAccessTokens.expiresAt, new Date()),
        isNull(bookingAccessTokens.revokedAt),
      ),
    )
    .limit(1);

  if (!booking) notFound();

  const items = await db
    .select({
      id: bookingItems.id,
      startsAt: bookingItems.startsAt,
      endsAt: bookingItems.endsAt,
      lineTotalCents: bookingItems.lineTotalCents,
      courtName: courts.name,
    })
    .from(bookingItems)
    .innerJoin(courts, eq(courts.id, bookingItems.courtId))
    .where(
      and(
        eq(bookingItems.bookingId, booking.id),
        eq(bookingItems.merchantId, booking.merchantId),
      ),
    )
    .orderBy(asc(bookingItems.startsAt));

  const deadlinePassed =
    booking.paymentDueAt !== null && booking.paymentDueAt <= new Date();
  const publicSiteHref = `/${booking.merchantSlug}/${booking.siteSlug}`;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href={publicSiteHref} className="font-black text-[var(--forest)]">
            Pikko.ph
          </Link>
          <span className="font-mono text-xs font-black">{booking.reference}</span>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <div className="rounded-3xl bg-[var(--forest)] p-7 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--lime)]">
            Booking received
          </p>
          <h1 className="display-type mt-3 text-4xl font-black sm:text-5xl">
            Complete your manual payment.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">
            Hi {booking.customerName}. Your booking request with {booking.merchantName} has been recorded. Keep this private link so you can return to the details.
          </p>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_21rem]">
          <div className="space-y-7">
            <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">
                    {booking.merchantName} · {booking.siteName}
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Court schedule</h2>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black uppercase text-amber-900">
                  {deadlinePassed ? "Payment deadline passed" : booking.paymentStatus}
                </span>
              </div>
              <div className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                    <div>
                      <p className="font-black">{item.courtName}</p>
                      <p className="mt-1 text-[var(--text-muted)]">
                        {formatDateTime(item.startsAt, booking.timezone)}–{new Intl.DateTimeFormat("en-PH", { timeZone: booking.timezone, timeStyle: "short" }).format(item.endsAt)}
                      </p>
                    </div>
                    <span className="font-black text-[var(--forest)]">
                      {formatPeso(item.lineTotalCents)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-4">
                <span className="font-black">Total due</span>
                <span className="text-2xl font-black">{formatPeso(booking.totalCents)}</span>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--coral)]">
                Payment instructions
              </p>
              <h2 className="mt-2 text-2xl font-black">Pay the venue directly</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-muted)]">
                {booking.manualPaymentInstructions ||
                  "Contact the venue using your booking reference for its current payment instructions."}
              </p>
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Booking status
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[var(--text-muted)]">Reference</dt>
                <dd className="mt-1 font-mono font-black">{booking.reference}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Email</dt>
                <dd className="mt-1 break-all font-bold">{booking.customerEmail}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Pay by</dt>
                <dd className="mt-1 font-bold">
                  {booking.paymentDueAt
                    ? formatDateTime(booking.paymentDueAt, booking.timezone)
                    : "Confirm with venue"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 rounded-2xl bg-[var(--cream)] p-4 text-xs leading-5 text-[var(--text-muted)]">
              {booking.manualReservationMode === "reserve_immediately"
                ? "The court is reserved until the payment deadline. The merchant will confirm it after verifying payment."
                : "The court is not guaranteed until the merchant verifies payment."}
            </p>
            <Link
              href={publicSiteHref}
              className="mt-5 inline-flex w-full justify-center rounded-full border border-[var(--forest)] px-5 py-3 text-sm font-black text-[var(--forest)]"
            >
              Book another court
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
