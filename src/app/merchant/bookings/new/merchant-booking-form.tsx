"use client";

import { useActionState, useMemo, useState } from "react";
import type { CourtAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";
import {
  createMerchantBooking,
  type MerchantBookingState,
} from "./actions";

type Selection = { courtId: string; starts: string[] } | null;

const initialState: MerchantBookingState = { error: null };

export function MerchantBookingForm({
  courts,
  siteSlug,
  date,
}: {
  courts: CourtAvailability[];
  siteSlug: string;
  date: string;
}) {
  const [state, formAction, pending] = useActionState(
    createMerchantBooking,
    initialState,
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [source, setSource] = useState("merchant_walk_in");

  function toggleSlot(court: CourtAvailability, startsAt: string) {
    setSelection((current) => {
      if (!current || current.courtId !== court.id) {
        return { courtId: court.id, starts: [startsAt] };
      }

      const slotOrder = new Map(
        court.slots.map((slot, index) => [slot.startsAt, index]),
      );
      const clickedIndex = slotOrder.get(startsAt);
      if (clickedIndex === undefined) return current;
      const selectedIndexes = current.starts
        .map((start) => slotOrder.get(start))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right);
      const existingIndex = selectedIndexes.indexOf(clickedIndex);

      if (existingIndex >= 0) {
        if (selectedIndexes.length === 1) return null;
        if (
          existingIndex === 0 ||
          existingIndex === selectedIndexes.length - 1
        ) {
          return {
            courtId: court.id,
            starts: current.starts.filter((start) => start !== startsAt),
          };
        }
        return { courtId: court.id, starts: [startsAt] };
      }

      const minimum = selectedIndexes[0];
      const maximum = selectedIndexes[selectedIndexes.length - 1];
      if (clickedIndex === minimum - 1 || clickedIndex === maximum + 1) {
        return {
          courtId: court.id,
          starts: [...current.starts, startsAt].sort(),
        };
      }

      return { courtId: court.id, starts: [startsAt] };
    });
  }

  const summary = useMemo(() => {
    if (!selection) return null;
    const court = courts.find((item) => item.id === selection.courtId);
    if (!court) return null;
    const slots = court.slots.filter((slot) =>
      selection.starts.includes(slot.startsAt),
    );
    return {
      court,
      slots,
      totalCents: slots.reduce((total, slot) => total + slot.rateCents, 0),
    };
  }, [courts, selection]);

  return (
    <form action={formAction} className="mt-6 grid gap-6 xl:grid-cols-[1fr_23rem]">
      <input type="hidden" name="siteSlug" value={siteSlug} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="courtId" value={selection?.courtId ?? ""} />
      <input type="hidden" name="starts" value={selection?.starts.join(",") ?? ""} />

      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">1 · Court time</p>
          <h2 className="mt-2 text-xl font-black">Select one court and adjacent hours</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Only currently available slots are shown. The server checks them again when you save.
          </p>
        </div>

        {courts.map((court) => (
          <article
            key={court.id}
            className={`rounded-2xl border bg-white p-5 ${selection?.courtId === court.id ? "border-[var(--forest)]" : "border-[var(--line)]"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{court.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}
                </p>
              </div>
              <p className="text-xs font-black text-[var(--forest)]">
                {court.slots.length} open {court.slots.length === 1 ? "time" : "times"}
              </p>
            </div>
            {court.slots.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {court.slots.map((slot) => {
                  const selected =
                    selection?.courtId === court.id &&
                    selection.starts.includes(slot.startsAt);
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSlot(court, slot.startsAt)}
                      className={`rounded-xl border px-3 py-3 text-left ${selected ? "border-[var(--forest)] bg-[var(--forest)] text-white" : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--forest)]"}`}
                    >
                      <span className="block text-sm font-black">{slot.label}</span>
                      <span className={`mt-1 block text-xs ${selected ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                        {formatPeso(slot.rateCents)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--cream)] px-4 py-5 text-sm text-[var(--text-muted)]">No open times remain for this court.</p>
            )}
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-5 xl:sticky xl:top-32">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">2 · Booking details</p>
        {summary ? (
          <div className="mt-4 rounded-2xl bg-[var(--forest)] p-4 text-white">
            <p className="font-black">{summary.court.name}</p>
            <p className="mt-1 text-xs text-white/70">
              {summary.slots.map((slot) => slot.label).join(", ")} · {summary.slots.length} {summary.slots.length === 1 ? "hour" : "hours"}
            </p>
            <p className="mt-3 text-xl font-black">{formatPeso(summary.totalCents)}</p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-[var(--cream)] px-4 py-5 text-sm font-semibold text-[var(--text-muted)]">
            Select a court time to continue.
          </p>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-xs font-black">
            Booking source
            <select
              name="source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal"
            >
              <option value="merchant_walk_in">Walk-in</option>
              <option value="merchant_phone">Phone reservation</option>
              <option value="merchant_complimentary">Complimentary</option>
            </select>
          </label>
          <label className="block text-xs font-black">
            Customer name
            <input name="customerName" required minLength={2} maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
          </label>
          <label className="block text-xs font-black">
            Email <span className="font-normal">(optional)</span>
            <input name="customerEmail" type="email" maxLength={320} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
          </label>
          <label className="block text-xs font-black">
            Mobile number <span className="font-normal">(optional)</span>
            <input name="customerMobileNumber" type="tel" maxLength={40} placeholder="09xx xxx xxxx" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
          </label>
          {source === "merchant_complimentary" ? (
            <input type="hidden" name="paymentHandling" value="complimentary" />
          ) : (
            <label className="block text-xs font-black">
              Payment
              <select name="paymentHandling" defaultValue="cash_paid" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal">
                <option value="cash_paid">Paid in cash</option>
                <option value="pay_at_venue">Pay at venue</option>
              </select>
            </label>
          )}
          <label className="block text-xs font-black">
            Internal notes <span className="font-normal">(optional)</span>
            <textarea name="internalNotes" rows={3} maxLength={1000} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
          </label>
        </div>

        {state.error ? (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{state.error}</p>
        ) : null}

        <button
          disabled={!summary || pending}
          className="mt-5 w-full rounded-full bg-[var(--forest)] px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Creating booking…" : "Create & reserve court"}
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">
          Staff-created bookings reserve the selected court immediately.
        </p>
      </aside>
    </form>
  );
}
