"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AvailabilityLegend,
  availabilityStateLabels,
  availabilityStateStyles,
} from "@/components/availability-legend";
import type { CourtAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";

type Selection = { courtId: string; starts: string[] } | null;

const ONE_HOUR_MS = 60 * 60 * 1_000;

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
  const timeRows = useMemo(
    () =>
      Array.from(
        new Map(
          courts.flatMap((court) =>
            court.schedule
              .filter((slot) => slot.state !== "past" && slot.state !== "closed")
              .map((slot) => [slot.startsAt, slot.label] as const),
          ),
        ),
      )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([startsAt, label]) => ({ startsAt, label })),
    [courts],
  );
  const scheduleByCourt = useMemo(
    () =>
      new Map(
        courts.map((court) => [
          court.id,
          new Map(court.schedule.map((slot) => [slot.startsAt, slot])),
        ]),
      ),
    [courts],
  );

  function toggleSlot(court: CourtAvailability, startsAt: string) {
    setSelection((current) => {
      if (!current || current.courtId !== court.id) {
        return { courtId: court.id, starts: [startsAt] };
      }

      const selected = [...current.starts].sort();
      const existingIndex = selected.indexOf(startsAt);

      if (existingIndex >= 0) {
        if (selected.length === 1) return null;
        if (existingIndex === 0 || existingIndex === selected.length - 1) {
          return {
            courtId: court.id,
            starts: selected.filter((start) => start !== startsAt),
          };
        }
        return { courtId: court.id, starts: [startsAt] };
      }

      const clickedTime = new Date(startsAt).getTime();
      const minimumTime = new Date(selected[0]).getTime();
      const maximumTime = new Date(selected[selected.length - 1]).getTime();
      if (clickedTime === minimumTime - ONE_HOUR_MS || clickedTime === maximumTime + ONE_HOUR_MS) {
        return { courtId: court.id, starts: [...selected, startsAt].sort() };
      }

      return { courtId: court.id, starts: [startsAt] };
    });
  }

  const summary = useMemo(() => {
    if (!selection) return null;
    const court = courts.find((item) => item.id === selection.courtId);
    if (!court) return null;
    const selectedStarts = new Set(selection.starts);
    const slots = court.slots.filter((slot) => selectedStarts.has(slot.startsAt));
    const totalCents = slots.reduce((total, slot) => total + slot.rateCents, 0);
    const query = new URLSearchParams({
      date,
      court: court.id,
      starts: slots.map((slot) => slot.startsAt).join(","),
    });
    return { court, slots, totalCents, href: `${checkoutPath}?${query.toString()}` };
  }, [checkoutPath, courts, date, selection]);

  if (timeRows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center">
        <p className="font-black">No future booking hours remain for this date.</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Choose another day to see court availability.</p>
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">All courts</p>
            <h2 className="mt-1 text-2xl font-black">Choose an open hour</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Scroll sideways to compare every court at the same time.</p>
          </div>
          <AvailabilityLegend states={["selected", "available", "booked", "held", "blocked", "unavailable"]} />
        </div>

        <div className="mt-5 overflow-x-auto pb-2">
          <div
            role="grid"
            aria-label="Court availability by hour"
            className="grid gap-2"
            style={{
              gridTemplateColumns: `5.5rem repeat(${courts.length}, minmax(8.5rem, 1fr))`,
              minWidth: `${5.5 + courts.length * 8.5}rem`,
            }}
          >
            <div role="columnheader" className="sticky left-0 z-20 bg-white px-2 py-3 text-xs font-black text-[var(--text-muted)]">
              Time
            </div>
            {courts.map((court) => (
              <div
                key={court.id}
                role="columnheader"
                className={`rounded-2xl border px-3 py-3 text-center ${
                  selection?.courtId === court.id
                    ? "border-sky-600 bg-sky-50"
                    : "border-[var(--line)] bg-[var(--paper)]"
                }`}
              >
                <span className="block text-sm font-black">{court.name}</span>
                <span className="mt-1 block text-[0.68rem] font-semibold text-[var(--text-muted)]">
                  {court.indoor ? "Indoor" : "Outdoor"} · from {formatPeso(court.baseHourlyRateCents)}
                </span>
              </div>
            ))}

            {timeRows.map((row) => (
              <div key={row.startsAt} className="contents" role="row">
                <div role="rowheader" className="sticky left-0 z-10 flex min-h-16 items-center bg-white px-2 text-sm font-black text-[var(--forest)]">
                  {row.label}
                </div>
                {courts.map((court) => {
                  const slot = scheduleByCourt.get(court.id)?.get(row.startsAt);
                  if (!slot || slot.state === "closed" || slot.state === "past") {
                    return <div key={court.id} role="gridcell" aria-hidden="true" className="min-h-16" />;
                  }
                  const selected = selection?.courtId === court.id && selection.starts.includes(row.startsAt);
                  const displayState = selected ? "selected" : slot.state;
                  const label = availabilityStateLabels[displayState];
                  const content = (
                    <>
                      <span className="block text-xs font-black">{label}</span>
                      {slot.rateCents !== null && (slot.state === "available" || selected) ? (
                        <span className={`mt-1 block text-[0.68rem] ${selected ? "text-white/80" : "opacity-75"}`}>
                          {formatPeso(slot.rateCents)}
                        </span>
                      ) : null}
                    </>
                  );

                  return slot?.state === "available" ? (
                    <div key={court.id} role="gridcell">
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${court.name}, ${row.label}, ${label}${slot.rateCents !== null ? `, ${formatPeso(slot.rateCents)}` : ""}`}
                        onClick={() => toggleSlot(court, row.startsAt)}
                        className={`min-h-16 w-full rounded-2xl border px-3 py-2 text-left transition ${availabilityStateStyles[displayState]}`}
                      >
                        {content}
                      </button>
                    </div>
                  ) : (
                    <div
                      key={court.id}
                      role="gridcell"
                      aria-label={`${court.name}, ${row.label}, ${label}`}
                      className={`flex min-h-16 items-center rounded-2xl border px-3 py-2 ${availabilityStateStyles[displayState]}`}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {summary ? (
        <aside className="sticky bottom-4 z-30 mt-6 rounded-3xl border border-[var(--forest)] bg-[var(--forest)] p-5 text-white shadow-2xl sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">Selected</p>
            <p className="mt-1 font-black">
              {summary.court.name} · {summary.slots.length} {summary.slots.length === 1 ? "hour" : "hours"}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {summary.slots[0]?.label}–{new Intl.DateTimeFormat("en-PH", {
                timeZone: "Asia/Manila",
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(summary.slots.at(-1)?.endsAt ?? ""))} · {formatPeso(summary.totalCents)}
            </p>
          </div>
          <Link
            href={summary.href}
            className="mt-4 inline-flex w-full justify-center rounded-full bg-[var(--lime)] px-6 py-3 text-sm font-black text-[var(--ink)] sm:mt-0 sm:w-auto"
          >
            Continue to details
          </Link>
        </aside>
      ) : null}
    </>
  );
}
