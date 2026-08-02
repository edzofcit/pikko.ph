import { and, asc, eq, gt, isNull } from "drizzle-orm";
import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import {
  bookingAccessTokens,
  bookingItems,
  bookings,
  courts,
  manualPaymentProofs,
  merchants,
  sites,
} from "@/db/schema";
import { formatPeso } from "@/lib/money";
import { hashBookingAccessToken } from "@/lib/booking/access-token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};

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
  searchParams: Promise<{ token?: string; uploaded?: string; error?: string }>;
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
        eq(bookingAccessTokens.tokenHash, hashBookingAccessToken(token)),
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

  const proofs = await db
    .select({
      id: manualPaymentProofs.id,
      status: manualPaymentProofs.status,
      originalFilename: manualPaymentProofs.originalFilename,
      customerNotes: manualPaymentProofs.customerNotes,
      rejectionReason: manualPaymentProofs.rejectionReason,
      createdAt: manualPaymentProofs.createdAt,
    })
    .from(manualPaymentProofs)
    .where(
      and(
        eq(manualPaymentProofs.bookingId, booking.id),
        eq(manualPaymentProofs.merchantId, booking.merchantId),
      ),
    )
    .orderBy(asc(manualPaymentProofs.createdAt));

  const deadlinePassed =
    booking.paymentDueAt !== null && booking.paymentDueAt <= new Date();
  const publicSiteHref = `/${booking.merchantSlug}/${booking.siteSlug}`;
  const acceptsProofs =
    ["pending_payment", "pending_verification"].includes(booking.status) &&
    booking.paymentStatus !== "paid";

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

            <section className="rounded-3xl border border-[var(--line)] bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--coral)]">
                Payment proof
              </p>
              <h2 className="mt-2 text-2xl font-black">Upload your payment screenshot</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                The merchant will review your screenshot before confirming the booking.
              </p>

              {query.uploaded === "1" ? (
                <p className="mt-4 rounded-2xl bg-[var(--mint)] p-4 text-sm font-bold text-[var(--forest)]">
                  Screenshot uploaded. Your booking is now awaiting merchant verification.
                </p>
              ) : null}
              {query.error ? (
                <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">
                  {query.error}
                </p>
              ) : null}

              {acceptsProofs ? (
                <form
                  action={`/api/bookings/${encodeURIComponent(booking.reference)}/payment-proof`}
                  method="post"
                  encType="multipart/form-data"
                  className="mt-5 space-y-4"
                >
                  <input type="hidden" name="token" value={token} />
                  <label className="block text-sm font-bold">
                    Screenshot
                    <input
                      type="file"
                      name="screenshot"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      className="mt-2 block w-full rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[var(--forest)] file:px-4 file:py-2 file:font-bold file:text-white"
                    />
                  </label>
                  <p className="text-xs text-[var(--text-muted)]">JPG, PNG, or WebP · maximum 3 MB</p>
                  <label className="block text-sm font-bold">
                    Notes for the merchant (optional)
                    <textarea
                      name="notes"
                      maxLength={500}
                      rows={3}
                      placeholder="Example: Paid from account ending in 1234"
                      className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 font-normal outline-none focus:border-[var(--forest)]"
                    />
                  </label>
                  <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
                    Submit payment proof
                  </button>
                </form>
              ) : (
                <p className="mt-5 rounded-2xl bg-[var(--paper)] p-4 text-sm text-[var(--text-muted)]">
                  This booking is no longer accepting payment screenshots.
                </p>
              )}

              {proofs.length ? (
                <div className="mt-7 space-y-4 border-t border-[var(--line)] pt-5">
                  <h3 className="font-black">Submitted screenshots</h3>
                  {proofs.map((proof) => (
                    <article key={proof.id} className="overflow-hidden rounded-2xl border border-[var(--line)]">
                      <Image
                        src={`/api/payment-proofs/${proof.id}?token=${encodeURIComponent(token)}`}
                        alt={`Payment proof ${proof.originalFilename}`}
                        width={1200}
                        height={800}
                        unoptimized
                        className="h-48 w-full bg-[var(--paper)] object-contain"
                      />
                      <div className="p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate font-bold">{proof.originalFilename}</span>
                          <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-black uppercase">
                            {proof.status}
                          </span>
                        </div>
                        {proof.customerNotes ? <p className="mt-2 text-[var(--text-muted)]">{proof.customerNotes}</p> : null}
                        {proof.rejectionReason ? (
                          <p className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-800">
                            Merchant response: {proof.rejectionReason}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
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
