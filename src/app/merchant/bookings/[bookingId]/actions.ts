"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  bookingItems,
  bookings,
  manualPaymentProofs,
  payments,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reviewUrl(bookingId: string, kind: "success" | "error", message: string) {
  return `/merchant/bookings/${bookingId}?${kind}=${encodeURIComponent(message)}`;
}

function isCourtConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string; message?: string };
  return (
    candidate.code === "23P01" ||
    candidate.constraint === "court_allocations_no_active_overlap" ||
    candidate.message?.includes("court_allocations_no_active_overlap") === true
  );
}

async function getAuthorizedProof(proofId: string) {
  const access = await requireMerchantPermission("verify_payments");
  const db = getDb();
  const [proof] = await db
    .select({
      id: manualPaymentProofs.id,
      status: manualPaymentProofs.status,
      bookingId: manualPaymentProofs.bookingId,
      paymentId: manualPaymentProofs.paymentId,
      merchantId: manualPaymentProofs.merchantId,
      siteId: bookings.siteId,
      bookingStatus: bookings.status,
      paymentStatus: bookings.paymentStatus,
      provider: payments.provider,
    })
    .from(manualPaymentProofs)
    .innerJoin(bookings, eq(bookings.id, manualPaymentProofs.bookingId))
    .innerJoin(payments, eq(payments.id, manualPaymentProofs.paymentId))
    .where(
      and(
        eq(manualPaymentProofs.id, proofId),
        eq(manualPaymentProofs.merchantId, access.membership.merchantId),
      ),
    )
    .limit(1);

  if (!proof || !access.sites.some((site) => site.id === proof.siteId)) {
    redirect("/access-denied");
  }
  return { access, db, proof };
}

export async function approveManualPaymentProof(formData: FormData) {
  const proofId = String(formData.get("proofId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID_PATTERN.test(proofId) || !UUID_PATTERN.test(bookingId)) {
    redirect("/merchant");
  }

  const { access, db, proof } = await getAuthorizedProof(proofId);
  if (proof.bookingId !== bookingId || proof.provider !== "manual") {
    redirect(reviewUrl(bookingId, "error", "Invalid manual payment proof."));
  }
  if (
    proof.status !== "submitted" ||
    !["pending_payment", "pending_verification"].includes(proof.bookingStatus) ||
    proof.paymentStatus === "paid"
  ) {
    redirect(reviewUrl(bookingId, "error", "This payment proof has already been processed."));
  }

  const items = await db
    .select({
      id: bookingItems.id,
      merchantId: bookingItems.merchantId,
      courtId: bookingItems.courtId,
      startsAt: bookingItems.startsAt,
      endsAt: bookingItems.endsAt,
    })
    .from(bookingItems)
    .where(
      and(
        eq(bookingItems.bookingId, proof.bookingId),
        eq(bookingItems.merchantId, proof.merchantId),
      ),
    );

  if (!items.length) {
    redirect(reviewUrl(bookingId, "error", "This booking has no court slots."));
  }

  const now = new Date();
  let approvalApplied = false;
  try {
    const result = await db.execute(sql`
      with approved_proof as (
        update manual_payment_proofs
        set status = 'approved',
            reviewed_by_user_id = ${access.user.id},
            reviewed_at = ${now},
            rejection_reason = null
        where id = ${proof.id}
          and merchant_id = ${proof.merchantId}
          and status = 'submitted'
        returning booking_id, payment_id
      ),
      released_expired as (
        update court_allocations as allocation
        set active = false, released_at = ${now}
        where allocation.active = true
          and allocation.expires_at <= ${now}
          and allocation.court_id in (
            select item.court_id
            from booking_items as item
            join approved_proof on approved_proof.booking_id = item.booking_id
          )
        returning allocation.id
      ),
      secured_slots as (
        insert into court_allocations (
          merchant_id, court_id, kind, booking_item_id, starts_at, ends_at,
          active, expires_at, released_at, created_at
        )
        select
          item.merchant_id, item.court_id, 'booking', item.id,
          item.starts_at, item.ends_at, true, null, null, ${now}
        from booking_items as item
        join approved_proof on approved_proof.booking_id = item.booking_id
        on conflict (booking_item_id) do update
          set active = true, expires_at = null, released_at = null
        returning id
      ),
      paid_payment as (
        update payments as payment
        set status = 'paid', paid_at = ${now}, updated_at = ${now}
        from approved_proof
        where payment.id = approved_proof.payment_id
        returning payment.id
      )
      update bookings as booking
      set status = 'confirmed',
          payment_status = 'paid',
          confirmed_at = ${now},
          updated_at = ${now}
      from approved_proof
      where booking.id = approved_proof.booking_id
      returning booking.id
    `);

    approvalApplied = result.rows.length > 0;
  } catch (error) {
    if (isCourtConflict(error)) {
      redirect(
        reviewUrl(
          bookingId,
          "error",
          "The court slot is no longer available. The booking was not confirmed.",
        ),
      );
    }
    console.error("Manual payment approval failed", error);
    redirect(reviewUrl(bookingId, "error", "Payment approval failed. Please try again."));
  }

  if (!approvalApplied) {
    redirect(reviewUrl(bookingId, "error", "This payment proof has already been processed."));
  }

  revalidatePath("/merchant");
  revalidatePath(`/merchant/bookings/${bookingId}`);
  redirect(reviewUrl(bookingId, "success", "Payment approved and booking confirmed."));
}

export async function rejectManualPaymentProof(formData: FormData) {
  const proofId = String(formData.get("proofId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID_PATTERN.test(proofId) || !UUID_PATTERN.test(bookingId)) {
    redirect("/merchant");
  }
  if (reason.length < 5 || reason.length > 500) {
    redirect(reviewUrl(bookingId, "error", "Add a rejection reason between 5 and 500 characters."));
  }

  const { access, db, proof } = await getAuthorizedProof(proofId);
  if (
    proof.bookingId !== bookingId ||
    proof.provider !== "manual" ||
    proof.status !== "submitted" ||
    proof.paymentStatus === "paid"
  ) {
    redirect(reviewUrl(bookingId, "error", "This payment proof cannot be rejected."));
  }

  const now = new Date();
  const result = await db.execute(sql`
    with rejected_proof as (
      update manual_payment_proofs
      set status = 'rejected',
          reviewed_by_user_id = ${access.user.id},
          reviewed_at = ${now},
          rejection_reason = ${reason}
      where id = ${proof.id}
        and merchant_id = ${proof.merchantId}
        and status = 'submitted'
      returning booking_id, payment_id
    ),
    rejected_payment as (
      update payments as payment
      set status = 'rejected',
          failed_at = ${now},
          failure_code = 'MANUAL_PROOF_REJECTED',
          failure_message = ${reason},
          updated_at = ${now}
      from rejected_proof
      where payment.id = rejected_proof.payment_id
      returning payment.id
    )
    update bookings as booking
    set status = 'pending_payment',
        payment_status = 'rejected',
        updated_at = ${now}
    from rejected_proof
    where booking.id = rejected_proof.booking_id
    returning booking.id
  `);

  if (result.rows.length === 0) {
    redirect(reviewUrl(bookingId, "error", "This payment proof has already been processed."));
  }

  revalidatePath("/merchant");
  revalidatePath(`/merchant/bookings/${bookingId}`);
  redirect(reviewUrl(bookingId, "success", "Payment proof rejected. The customer can upload another screenshot."));
}
