"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CourtAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";

type Selection = { courtId: string; starts: string[] } | null;

export function SlotPicker({
  courts,
  date,
  checkoutPath,
}: {
  courts: CourtAvailability[];
  date: string;
  checkoutPath: string;
}) {
  const [selection, setSelection] = useState<Selection>(null);

  function toggleSlot(court: CourtAvailability, startsAt: string) {
    setSelection((current) => {
      if (!current || current.courtId !== court.id) {
        return { courtId: court.id, starts: [startsAt] };
      }

      const slotOrder = new Map(court.slots.map((slot, index) => [slot.startsAt, index]));
      const clickedIndex = slotOrder.get(startsAt);
      if (clickedIndex === undefined) return current;
      const selectedIndexes = current.starts
        .map((start) => slotOrder.get(start))
        .filter((index): index is number => index !== undefined)
        .sort((left, right) => left - right);
      const existingIndex = selectedIndexes.indexOf(clickedIndex);

      if (existingIndex >= 0) {
        if (selectedIndexes.length === 1) return null;
        if (existingIndex === 0 || existingIndex === selectedIndexes.length - 1) {
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
    const slots = court.slots.filter((slot) => selection.starts.includes(slot.startsAt));
    const totalCents = slots.reduce((total, slot) => total + slot.rateCents, 0);
    const query = new URLSearchParams({
      date,
      court: court.id,
      starts: slots.map((slot) => slot.startsAt).join(","),
    });
    return { court, slots, totalCents, href: `${checkoutPath}?${query.toString()}` };
  }, [checkoutPath, courts, date, selection]);

  return (
    <>
      <div className="space-y-5">
        {courts.map((court) => (
          <article key={court.id} className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{court.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}
                </p>
              </div>
              <span className="text-sm font-black text-[var(--forest)]">
                From {formatPeso(court.baseHourlyRateCents)}/hour
              </span>
            </div>

            {court.slots.length > 0 ? (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {court.slots.map((slot) => {
                  const selected =
                    selection?.courtId === court.id && selection.starts.includes(slot.startsAt);
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSlot(court, slot.startsAt)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                          : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--forest)]"
                      }`}
                    >
                      <span className="block text-sm font-black">{slot.label}</span>
                      <span className={`mt-1 block text-xs ${selected ? "text-white/75" : "text-[var(--text-muted)]"}`}>
                        {formatPeso(slot.rateCents)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-[var(--cream)] px-4 py-5 text-sm font-semibold text-[var(--text-muted)]">
                No bookable hourly slots remain for this date.
              </p>
            )}
          </article>
        ))}
      </div>

      {summary ? (
        <aside className="sticky bottom-4 mt-6 rounded-3xl border border-[var(--forest)] bg-[var(--forest)] p-5 text-white shadow-2xl sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">Selected</p>
            <p className="mt-1 font-black">
              {summary.court.name} · {summary.slots.length} {summary.slots.length === 1 ? "hour" : "hours"}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {summary.slots.map((slot) => slot.label).join(", ")} · {formatPeso(summary.totalCents)}
            </p>
          </div>
          <Link
            href={summary.href}
            className="mt-4 inline-flex w-full justify-center rounded-full bg-[var(--lime)] px-6 py-3 text-sm font-black text-[var(--ink)] sm:mt-0 sm:w-auto"
          >
            Review selection
          </Link>
        </aside>
      ) : null}
    </>
  );
}
