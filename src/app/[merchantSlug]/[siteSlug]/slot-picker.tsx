"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AvailabilityLegend,
  availabilityStateLabels,
} from "@/components/availability-legend";
import type { CourtAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";

type Selection = { courtId: string; starts: string[] } | null;

const ONE_HOUR_MS = 60 * 60 * 1_000;
const bookingStateStyles = {
  available: "border-emerald-300 bg-emerald-50 text-emerald-950 hover:border-[var(--forest)] hover:bg-[var(--mint)]",
  selected: "border-[var(--forest)] bg-[var(--forest)] text-white shadow-[0_5px_0_var(--lime)] ring-2 ring-[var(--forest)] ring-offset-2",
  booked: "border-zinc-300 bg-zinc-200 text-zinc-700",
  held: "border-amber-300 bg-amber-100 text-amber-950",
  blocked: "border-rose-300 bg-rose-100 text-rose-950",
  closed: "border-slate-200 bg-slate-100 text-slate-500",
  past: "border-stone-200 bg-stone-100 text-stone-400",
  unavailable: "border-orange-200 bg-orange-50 text-orange-800",
} as const;

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
      <section className="overflow-hidden rounded-[2rem] border border-[var(--forest)]/15 bg-[var(--forest)] shadow-[0_25px_75px_rgb(23_60_42_/_16%)]">
        <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-6 text-white sm:px-7 sm:py-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--lime)]">Court board · Live</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Build your session</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Choose an open hour, then tap adjacent times on the same court to play longer.</p>
          </div>
          <div className="rounded-2xl bg-white p-3 text-[var(--ink)]"><AvailabilityLegend states={["selected", "available", "booked", "held", "blocked", "unavailable"]} /></div>
        </div>

        <div className="overflow-x-auto bg-white px-3 pb-4 pt-3 sm:px-5 sm:pb-6 sm:pt-5">
          <div
            role="grid"
            aria-label="Court availability by hour"
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `5.5rem repeat(${courts.length}, minmax(8.5rem, 1fr))`,
              minWidth: `${5.5 + courts.length * 8.5}rem`,
            }}
          >
            <div role="columnheader" className="sticky left-0 z-20 flex min-h-[4.5rem] items-center rounded-xl bg-[var(--lime)] px-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--forest)] shadow-sm">
              Start
            </div>
            {courts.map((court) => (
              <div
                key={court.id}
                role="columnheader"
                className={`flex min-h-[4.5rem] flex-col justify-center rounded-2xl border px-3 py-3 text-center transition ${
                  selection?.courtId === court.id
                    ? "border-[var(--forest)] bg-[var(--mint)] shadow-[0_4px_0_var(--forest)]"
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
                <div role="rowheader" className="sticky left-0 z-10 flex min-h-[4.5rem] items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-sm font-black tabular-nums text-[var(--forest)] shadow-[5px_0_12px_rgb(255_255_255_/_90%)]">
                  {row.label}
                </div>
                {courts.map((court) => {
                  const slot = scheduleByCourt.get(court.id)?.get(row.startsAt);
                  if (!slot || slot.state === "closed" || slot.state === "past") {
                    return <div key={court.id} role="gridcell" aria-hidden="true" className="min-h-[4.5rem] rounded-2xl bg-[var(--cream)]/45" />;
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
                        className={`min-h-[4.5rem] w-full cursor-pointer rounded-2xl border px-3 py-2 text-left transition ${bookingStateStyles[displayState]}`}
                      >
                        {content}
                      </button>
                    </div>
                  ) : (
                    <div
                      key={court.id}
                      role="gridcell"
                      aria-label={`${court.name}, ${row.label}, ${label}`}
                      className={`flex min-h-[4.5rem] items-center rounded-2xl border px-3 py-2 ${bookingStateStyles[displayState]}`}
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
        <aside className="sticky bottom-4 z-30 mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--forest)] bg-[var(--lime)] text-[var(--forest)] shadow-[0_24px_70px_rgb(23_60_42_/_28%)] sm:grid sm:grid-cols-[1fr_auto] sm:items-stretch">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--forest)]/60">Your court ticket</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xl font-black">{summary.court.name}</p>
              <span className="text-sm font-bold">{summary.slots.length} {summary.slots.length === 1 ? "hour" : "hours"}</span>
            </div>
            <p className="mt-2 text-sm font-bold tabular-nums text-[var(--forest)]/75">
              {summary.slots[0]?.label}–{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(summary.slots.at(-1)?.endsAt ?? ""))}
            </p>
          </div>
          <div className="border-t border-dashed border-[var(--forest)]/30 p-4 sm:flex sm:min-w-[15rem] sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:p-5">
            <p className="text-center text-2xl font-black tabular-nums">{formatPeso(summary.totalCents)}</p>
            <Link href={summary.href} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--forest)] px-6 text-sm font-black text-white shadow-[0_4px_0_#0b2117]">Continue to details →</Link>
          </div>
        </aside>
      ) : null}
    </>
  );
}
