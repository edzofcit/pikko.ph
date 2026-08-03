"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createBooking,
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
  mayaEnabled,
  manualEnabled,
  customer,
}: {
  merchantSlug: string;
  siteSlug: string;
  date: string;
  courtId: string;
  starts: string[];
  deadlineMinutes: number;
  reserveImmediately: boolean;
  mayaEnabled: boolean;
  manualEnabled: boolean;
  customer: {
    signedIn: boolean;
    fullName: string;
    email: string;
    mobileNumber: string;
  } | null;
}) {
  const [paymentMethod, setPaymentMethod] = useState(mayaEnabled ? "maya" : "manual");
  const [state, formAction, pending] = useActionState(
    createBooking,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="merchantSlug" value={merchantSlug} />
      <input type="hidden" name="siteSlug" value={siteSlug} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="courtId" value={courtId} />
      <input type="hidden" name="starts" value={starts.join(",")} />

      <fieldset>
        <legend className="text-sm font-black">Choose how you want to pay</legend>
        <p className="mt-2 text-xs leading-5 text-white/65">You will only see the payment screen and instructions for the option selected here.</p>
        <div className="mt-3 grid gap-3">
          {mayaEnabled ? <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${paymentMethod === "maya" ? "border-[var(--lime)] bg-white/15" : "border-white/20 bg-white/5"}`}><input name="paymentMethod" type="radio" value="maya" checked={paymentMethod === "maya"} onChange={() => setPaymentMethod("maya")} className="mt-1" /><span><strong className="block text-white">Maya QR online payment</strong><span className="mt-1 block text-xs leading-5 text-white/65">Scan a dynamic QRPh code. Your booking confirms automatically after payment.</span></span></label> : null}
          {manualEnabled ? <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${paymentMethod === "manual" ? "border-[var(--lime)] bg-white/15" : "border-white/20 bg-white/5"}`}><input name="paymentMethod" type="radio" value="manual" checked={paymentMethod === "manual"} onChange={() => setPaymentMethod("manual")} className="mt-1" /><span><strong className="block text-white">Manual payment</strong><span className="mt-1 block text-xs leading-5 text-white/65">Follow the venue&apos;s payment instructions and upload a screenshot.</span></span></label> : null}
        </div>
      </fieldset>

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
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-white">{paymentMethod === "maya" ? "Maya QR payment" : "Manual payment"}</p>
          <span className="rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-black uppercase text-[var(--ink)]">Selected</span>
        </div>
        <p className="mt-1">
          {paymentMethod === "maya"
            ? "Your selected slots will be held while the one-time Maya QR is active. Confirmation is automatic after successful payment."
            : reserveImmediately
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
        <span>I accept this venue&apos;s booking, payment, and cancellation policies and the Pikko.ph <Link href="/terms" target="_blank" className="font-black text-white underline underline-offset-4">Terms &amp; Conditions</Link>. I acknowledge the <Link href="/privacy" target="_blank" className="font-black text-white underline underline-offset-4">Privacy Policy</Link>.</span>
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
        {pending ? "Preparing payment…" : paymentMethod === "maya" ? "Generate Maya QR" : "Continue to manual payment"}
      </button>
    </form>
  );
}
