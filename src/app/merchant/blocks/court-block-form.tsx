"use client";

import { useActionState, useMemo, useState } from "react";
import type { CourtAvailability } from "@/lib/booking/availability";
import { createCourtBlock, type CourtBlockState } from "./actions";

type Selection = { courtId: string; starts: string[] } | null;

const initialState: CourtBlockState = { error: null };
const ONE_HOUR_MS = 60 * 60 * 1_000;

function getInitialSelection(
  courts: CourtAvailability[],
  courtId?: string,
  starts: string[] = [],
): Selection {
  const court = courts.find((item) => item.id === courtId);
  if (!court) return null;
  const openStarts = new Set(court.slots.map((slot) => slot.startsAt));
  const selected = starts.filter((start) => openStarts.has(start)).sort();
  return selected.length ? { courtId: court.id, starts: selected } : null;
}

export function CourtBlockForm({
  courts,
  siteSlug,
  date,
  initialCourtId,
  initialStarts,
}: {
  courts: CourtAvailability[];
  siteSlug: string;
  date: string;
  initialCourtId?: string;
  initialStarts?: string[];
}) {
  const [state, formAction, pending] = useActionState(createCourtBlock, initialState);
  const [selection, setSelection] = useState<Selection>(() =>
    getInitialSelection(courts, initialCourtId, initialStarts),
  );

  function toggleSlot(court: CourtAvailability, startsAt: string) {
    setSelection((current) => {
      if (!current || current.courtId !== court.id) return { courtId: court.id, starts: [startsAt] };
      const selected = [...current.starts].sort();
      const existingIndex = selected.indexOf(startsAt);
      if (existingIndex >= 0) {
        if (selected.length === 1) return null;
        if (existingIndex === 0 || existingIndex === selected.length - 1) {
          return { courtId: court.id, starts: selected.filter((start) => start !== startsAt) };
        }
        return { courtId: court.id, starts: [startsAt] };
      }
      const clicked = new Date(startsAt).getTime();
      const minimum = new Date(selected[0]).getTime();
      const maximum = new Date(selected[selected.length - 1]).getTime();
      return clicked === minimum - ONE_HOUR_MS || clicked === maximum + ONE_HOUR_MS
        ? { courtId: court.id, starts: [...selected, startsAt].sort() }
        : { courtId: court.id, starts: [startsAt] };
    });
  }

  const summary = useMemo(() => {
    if (!selection) return null;
    const court = courts.find((item) => item.id === selection.courtId);
    if (!court) return null;
    const starts = new Set(selection.starts);
    return { court, slots: court.slots.filter((slot) => starts.has(slot.startsAt)) };
  }, [courts, selection]);

  return (
    <form action={formAction} className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
      <input type="hidden" name="siteSlug" value={siteSlug} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="courtId" value={selection?.courtId ?? ""} />
      <input type="hidden" name="starts" value={selection?.starts.join(",") ?? ""} />

      <div className="space-y-4">
        {courts.map((court) => (
          <article key={court.id} className={`rounded-2xl border bg-white p-5 ${selection?.courtId === court.id ? "border-rose-400" : "border-[var(--line)]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black">{court.name}</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Select adjacent open hours to remove from public availability.</p>
              </div>
              <span className="text-xs font-black text-[var(--forest)]">{court.slots.length} open</span>
            </div>
            {court.slots.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {court.slots.map((slot) => {
                  const selected = selection?.courtId === court.id && selection.starts.includes(slot.startsAt);
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSlot(court, slot.startsAt)}
                      className={`rounded-xl border px-3 py-3 text-left ${selected ? "border-rose-500 bg-rose-500 text-white" : "border-sky-300 bg-sky-100 text-sky-950 hover:border-sky-500"}`}
                    >
                      <span className="block text-sm font-black">{slot.label}</span>
                      <span className={`mt-1 block text-xs ${selected ? "text-white/75" : "text-sky-800"}`}>{selected ? "Will be blocked" : "Open"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--cream)] px-4 py-5 text-sm text-[var(--text-muted)]">No open hours remain.</p>
            )}
          </article>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-5 xl:sticky xl:top-32">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">Block details</p>
        {summary ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-rose-950">
            <p className="font-black">{summary.court.name}</p>
            <p className="mt-1 text-xs">{summary.slots.map((slot) => slot.label).join(", ")} · {summary.slots.length} {summary.slots.length === 1 ? "hour" : "hours"}</p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-[var(--cream)] px-4 py-5 text-sm text-[var(--text-muted)]">Select an open court hour.</p>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-xs font-black">
            Block type
            <select name="type" defaultValue="maintenance" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal">
              <option value="maintenance">Maintenance</option>
              <option value="private_event">Private event</option>
              <option value="temporary_closure">Temporary closure</option>
            </select>
          </label>
          <label className="block text-xs font-black">
            Internal reason <span className="font-normal">(optional)</span>
            <textarea name="reason" rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
          </label>
          <p className="rounded-xl bg-[var(--paper)] p-3 text-xs font-semibold leading-5 text-[var(--text-muted)]">
            Customers will see these hours as blocked. The internal reason is visible only to merchant staff.
          </p>
        </div>

        {state.error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{state.error}</p> : null}
        <button disabled={!summary || pending} className="mt-5 w-full rounded-full bg-rose-600 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Blocking court…" : "Block selected time"}
        </button>
      </aside>
    </form>
  );
}
