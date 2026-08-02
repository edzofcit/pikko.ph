import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import {
  bookingItems,
  bookings,
  courts,
  manualPaymentProofs,
  payments,
  sites,
  users,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";
import { approveManualPaymentProof, rejectManualPaymentProof } from "./actions";

export const metadata: Metadata = { title: "Review booking" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function MerchantBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [{ bookingId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireMerchantPermission("manage_bookings"),
  ]);
  const db = getDb();
  const [booking] = await db
    .select({
      id: bookings.id,
      merchantId: bookings.merchantId,
      siteId: bookings.siteId,
      reference: bookings.reference,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      customerMobileNumber: bookings.customerMobileNumber,
      customerNotes: bookings.customerNotes,
      totalCents: bookings.totalCents,
      createdAt: bookings.createdAt,
      paymentDueAt: bookings.paymentDueAt,
      confirmedAt: bookings.confirmedAt,
      siteName: sites.name,
      timezone: sites.timezone,
      paymentId: payments.id,
      provider: payments.provider,
    })
    .from(bookings)
    .innerJoin(sites, eq(sites.id, bookings.siteId))
    .innerJoin(payments, eq(payments.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.merchantId, access.membership.merchantId),
      ),
    )
    .limit(1);

  if (!booking || !access.sites.some((site) => site.id === booking.siteId)) {
    notFound();
  }
  const canVerifyPayment = access.permissions.some(
    (permission) => permission === "verify_payments",
  );

  const [items, proofs] = await Promise.all([
    db
      .select({
        id: bookingItems.id,
        courtName: courts.name,
        startsAt: bookingItems.startsAt,
        endsAt: bookingItems.endsAt,
        lineTotalCents: bookingItems.lineTotalCents,
      })
      .from(bookingItems)
      .innerJoin(courts, eq(courts.id, bookingItems.courtId))
      .where(eq(bookingItems.bookingId, booking.id))
      .orderBy(asc(bookingItems.startsAt)),
    db
      .select({
        id: manualPaymentProofs.id,
        status: manualPaymentProofs.status,
        originalFilename: manualPaymentProofs.originalFilename,
        mimeType: manualPaymentProofs.mimeType,
        sizeBytes: manualPaymentProofs.sizeBytes,
        customerNotes: manualPaymentProofs.customerNotes,
        rejectionReason: manualPaymentProofs.rejectionReason,
        createdAt: manualPaymentProofs.createdAt,
        reviewedAt: manualPaymentProofs.reviewedAt,
        reviewerName: users.fullName,
      })
      .from(manualPaymentProofs)
      .leftJoin(users, eq(users.id, manualPaymentProofs.reviewedByUserId))
      .where(eq(manualPaymentProofs.bookingId, booking.id))
      .orderBy(asc(manualPaymentProofs.createdAt)),
  ]);

  return (
    <DashboardShell
      eyebrow={`Payment review · ${booking.siteName}`}
      title={`Booking ${booking.reference}`}
      description="Review the customer's payment screenshot before confirming the court reservation."
      navigation={[
        { href: "/merchant", label: "Dashboard" },
        { href: "/customer", label: "Customer mode" },
      ]}
      metrics={[
        { label: "Booking status", value: booking.status.replaceAll("_", " "), note: `Created ${formatDateTime(booking.createdAt, booking.timezone)}` },
        { label: "Payment", value: booking.paymentStatus.replaceAll("_", " "), note: booking.provider === "manual" ? "Manual payment" : booking.provider },
        { label: "Amount", value: formatPeso(booking.totalCents), note: `${items.length} hour block${items.length === 1 ? "" : "s"}` },
        { label: "Proofs", value: String(proofs.length), note: `${proofs.filter((proof) => proof.status === "submitted").length} awaiting review` },
      ]}
    >
      {query.success || query.error ? (
        <p
          role={query.error ? "alert" : "status"}
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${
            query.error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {query.error ?? query.success}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-lg font-black">Payment screenshots</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Compare the amount and account details against your payment records before approving.
            </p>
            <div className="mt-5 space-y-5">
              {proofs.map((proof) => (
                <article key={proof.id} className="overflow-hidden rounded-2xl border border-[var(--line)]">
                  <Image
                    src={`/api/payment-proofs/${proof.id}`}
                    alt={`Payment proof ${proof.originalFilename}`}
                    width={1200}
                    height={900}
                    unoptimized
                    className="max-h-[32rem] w-full bg-[var(--paper)] object-contain"
                  />
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{proof.originalFilename}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Uploaded {formatDateTime(proof.createdAt, booking.timezone)} · {(proof.sizeBytes / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-black uppercase">
                        {proof.status}
                      </span>
                    </div>
                    {proof.customerNotes ? (
                      <p className="mt-4 rounded-xl bg-[var(--cream)] p-3 text-sm">
                        Customer note: {proof.customerNotes}
                      </p>
                    ) : null}

                    {proof.status === "submitted" && booking.paymentStatus !== "paid" && canVerifyPayment ? (
                      <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
                        <form action={approveManualPaymentProof}>
                          <input type="hidden" name="proofId" value={proof.id} />
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <button className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
                            Approve & confirm booking
                          </button>
                        </form>
                        <form action={rejectManualPaymentProof} className="space-y-3">
                          <input type="hidden" name="proofId" value={proof.id} />
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <input
                            name="reason"
                            required
                            minLength={5}
                            maxLength={500}
                            placeholder="Reason for rejection"
                            className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                          />
                          <button className="w-full rounded-full border border-red-300 px-5 py-3 text-sm font-black text-red-800">
                            Reject screenshot
                          </button>
                        </form>
                      </div>
                    ) : null}
                    {proof.status === "submitted" && !canVerifyPayment ? (
                      <p className="mt-4 rounded-xl bg-[var(--paper)] p-3 text-sm text-[var(--text-muted)]">
                        A site manager, cashier, or owner must verify this payment.
                      </p>
                    ) : null}
                    {proof.rejectionReason ? (
                      <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
                        Rejected: {proof.rejectionReason}
                      </p>
                    ) : null}
                    {proof.reviewedAt ? (
                      <p className="mt-3 text-xs text-[var(--text-muted)]">
                        Reviewed by {proof.reviewerName ?? "merchant staff"} on {formatDateTime(proof.reviewedAt, booking.timezone)}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
              {!proofs.length ? (
                <p className="rounded-2xl bg-[var(--paper)] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  The customer has not uploaded a payment screenshot yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-6">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-black">Customer</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-[var(--text-muted)]">Name</dt><dd className="mt-1 font-bold">{booking.customerName}</dd></div>
              <div><dt className="text-[var(--text-muted)]">Email</dt><dd className="mt-1 break-all font-bold">{booking.customerEmail}</dd></div>
              <div><dt className="text-[var(--text-muted)]">Mobile</dt><dd className="mt-1 font-bold">{booking.customerMobileNumber}</dd></div>
            </dl>
            {booking.customerNotes ? <p className="mt-4 rounded-xl bg-[var(--paper)] p-3 text-sm">{booking.customerNotes}</p> : null}
          </section>
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="font-black">Court schedule</h2>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {items.map((item) => (
                <div key={item.id} className="py-3 text-sm">
                  <p className="font-bold">{item.courtName}</p>
                  <p className="mt-1 text-[var(--text-muted)]">{formatDateTime(item.startsAt, booking.timezone)}</p>
                </div>
              ))}
            </div>
            <Link href="/merchant" className="mt-5 inline-flex text-sm font-black text-[var(--forest)]">
              ← Back to bookings
            </Link>
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
}
