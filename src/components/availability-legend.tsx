import type { AvailabilitySlotState } from "@/lib/booking/availability";

export type AvailabilityDisplayState = AvailabilitySlotState | "selected";

export const availabilityStateStyles: Record<AvailabilityDisplayState, string> = {
  available: "border-sky-300 bg-sky-100 text-sky-950 hover:border-sky-500 hover:bg-sky-200",
  selected: "border-sky-700 bg-sky-600 text-white shadow-sm ring-2 ring-sky-700 ring-offset-1",
  booked: "border-zinc-300 bg-zinc-200 text-zinc-700",
  held: "border-amber-300 bg-amber-100 text-amber-950",
  blocked: "border-rose-300 bg-rose-100 text-rose-950",
  closed: "border-slate-200 bg-slate-100 text-slate-500",
  past: "border-stone-200 bg-stone-100 text-stone-400",
  unavailable: "border-orange-200 bg-orange-50 text-orange-800",
};

export const availabilityStateLabels: Record<AvailabilityDisplayState, string> = {
  available: "Open",
  selected: "Your pick",
  booked: "Taken",
  held: "Reserved",
  blocked: "Blocked",
  closed: "Closed",
  past: "Past",
  unavailable: "Unavailable",
};

export function AvailabilityLegend({
  states,
}: {
  states: AvailabilityDisplayState[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-[var(--text-muted)]" aria-label="Availability legend">
      {states.map((state) => (
        <span key={state} className="inline-flex items-center gap-2">
          <span className={`size-3 rounded-sm border ${availabilityStateStyles[state]}`} aria-hidden="true" />
          {availabilityStateLabels[state]}
        </span>
      ))}
    </div>
  );
}
