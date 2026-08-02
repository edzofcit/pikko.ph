"use client";

import { useActionState } from "react";
import {
  createManualBooking,
  type ManualBookingState,
} from "./actions";

const initialState: ManualBookingState = { error: null };

export function CheckoutForm({
  merchantSlug,
  siteSlug,
  date,
  courtId,
  starts,
  deadlineMinutes,
  reserveImmediately,
  customer,
}: {
  merchantSlug: string;
  siteSlug: string;
  date: string;
  courtId: string;
  starts: string[];
  deadlineMinutes: number;
  reserveImmediately: boolean;
  customer: {
    signedIn: boolean;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(
    createManualBooking,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="siteSlug" value={siteSlug} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="starts" value={starts.join(",")} />

      <label className="block text-sm font-bold">
        Full name
        <input
          name="fullName"
          required
          minLength={2}
          maxLength={160}
          autoComplete="name"
          defaultValue={customer?.fullName}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 font-normal text-[var(--ink)]"
        />
      </label>
      <label className="block text-sm font-bold">
        Email address
        <input
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          defaultValue={customer?.email}
          readOnly={customer?.signedIn}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 font-normal text-[var(--ink)]"
        />
      </label>
      <label className="block text-sm font-bold">
        Mobile number
        <input
          name="mobileNumber"
          type="tel"
          required
          minLength={7}
          maxLength={40}
          autoComplete="tel"
          placeholder="09xx xxx xxxx"
          defaultValue={customer?.mobileNumber}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 font-normal text-[var(--ink)]"
        />
      </label>

      {customer?.signedIn ? (
        <p className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/80">
          Signed in as <strong className="text-white">{customer.email}</strong>. This booking will appear in your customer account.
        </p>
      ) : null}
      <label className="block text-sm font-bold">
        Notes <span className="font-normal text-white/60">(optional)</span>
        <textarea
          name="customerNotes"
          maxLength={1000}
          rows={3}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white px-4 py-3 font-normal text-[var(--ink)]"
        />
      </label>

      <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/80">
        <p className="font-black text-white">Manual payment</p>
        <p className="mt-1">
          {reserveImmediately
            ? `Your court will be reserved for ${deadlineMinutes} minutes while you send payment.`
            : "Your request will not reserve the court until the merchant verifies payment."}
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm leading-5 text-white/80">
        <input
          name="acceptPolicies"
          type="checkbox"
          required
          className="mt-1"
        />
        <span>I accept this venue&apos;s booking, payment, and cancellation policies.</span>
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--lime)] px-5 py-3.5 text-sm font-black text-[var(--ink)] disabled:opacity-60"
      >
        {pending ? "Reserving your court…" : "Book with manual payment"}
      </button>
    </form>
  );
}
