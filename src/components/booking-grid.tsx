"use client";

import { useMemo, useState } from "react";

type Court = {
  id: string;
  name: string;
  venue: string;
  location: string;
  surface: string;
  prices: Record<string, number>;
};

const dates = [
  { day: "SAT", date: "08", label: "August 8" },
  { day: "SUN", date: "09", label: "August 9" },
  { day: "MON", date: "10", label: "August 10" },
  { day: "TUE", date: "11", label: "August 11" },
];

const slots = ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

const courts: Court[] = [
  {
    id: "kitchen-01",
    name: "Court 01",
    venue: "The Kitchen",
    location: "BGC, Taguig",
    surface: "Indoor · Pro cushion",
    prices: { "4:00 PM": 650, "5:00 PM": 650, "6:00 PM": 750, "8:00 PM": 750 },
  },
  {
    id: "rally-03",
    name: "Court 03",
    venue: "Rally Club",
    location: "Makati City",
    surface: "Covered · Acrylic",
    prices: { "4:00 PM": 600, "6:00 PM": 700, "7:00 PM": 700, "8:00 PM": 700 },
  },
  {
    id: "paddle-02",
    name: "Center Court",
    venue: "Paddle Yard",
    location: "Pasig City",
    surface: "Outdoor · Acrylic",
    prices: { "5:00 PM": 550, "6:00 PM": 650, "7:00 PM": 650 },
  },
];

export function BookingGrid() {
  const [activeDate, setActiveDate] = useState(0);
  const [selected, setSelected] = useState<{ courtId: string; slot: string }[]>([]);

  const total = useMemo(
    () =>
      selected.reduce((sum, item) => {
        const court = courts.find((candidate) => candidate.id === item.courtId);
        return sum + (court?.prices[item.slot] ?? 0);
      }, 0),
    [selected],
  );

  function toggleSlot(courtId: string, slot: string) {
    setSelected((current) => {
      const exists = current.some((item) => item.courtId === courtId && item.slot === slot);
      if (exists) {
        const clickedIndex = slots.indexOf(slot);
        const remaining = current.filter((item) => item.slot !== slot);
        const beforeClicked = remaining.filter((item) => slots.indexOf(item.slot) < clickedIndex);
        const afterClicked = remaining.filter((item) => slots.indexOf(item.slot) > clickedIndex);
        return beforeClicked.length ? beforeClicked : afterClicked;
      }

      const differentCourt = current.some((item) => item.courtId !== courtId);
      if (differentCourt || current.length === 0) {
        return [{ courtId, slot }];
      }

      const selectedIndexes = current.map((item) => slots.indexOf(item.slot));
      const clickedIndex = slots.indexOf(slot);
      const extendsRange =
        clickedIndex === Math.min(...selectedIndexes) - 1 ||
        clickedIndex === Math.max(...selectedIndexes) + 1;

      return extendsRange ? [...current, { courtId, slot }] : [{ courtId, slot }];
    });
  }

  function changeDate(index: number) {
    setActiveDate(index);
    setSelected([]);
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[0_18px_55px_rgb(23_34_26_/_8%)]">
      <div className="border-b border-[var(--line)] p-4 sm:p-6">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose booking date">
          {dates.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={activeDate === index}
              onClick={() => changeDate(index)}
              className={`min-w-20 rounded-2xl border px-4 py-3 text-center transition ${
                activeDate === index
                  ? "border-[var(--forest)] bg-[var(--forest)] text-white"
                  : "border-[var(--line)] bg-[var(--paper)] hover:border-[var(--forest)]/50"
              }`}
            >
              <span className="block text-[10px] font-bold tracking-[0.14em] opacity-65">{item.day}</span>
              <span className="mt-1 block text-xl font-black">{item.date}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {courts.map((court) => (
          <article key={court.id} className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[240px_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#58b875]" />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Available</span>
              </div>
              <h3 className="mt-2 text-xl font-black">{court.venue}</h3>
              <p className="mt-1 text-sm font-semibold text-[var(--forest)]">{court.name} · {court.location}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{court.surface}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {slots.map((slot) => {
                const price = court.prices[slot];
                const isSelected = selected.some((item) => item.courtId === court.id && item.slot === slot);

                if (!price) {
                  return (
                    <div key={slot} className="rounded-xl border border-dashed border-[var(--line)] bg-[#f7f7f2] px-2 py-3 text-center text-xs text-[var(--muted)]/55">
                      <span className="block font-semibold">{slot}</span>
                      <span className="mt-1 block">Booked</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSlot(court.id, slot)}
                    className={`rounded-xl border px-2 py-3 text-center text-xs transition ${
                      isSelected
                        ? "border-[var(--ink)] bg-[var(--lime)] text-[var(--ink)] shadow-[0_3px_0_var(--ink)]"
                        : "border-[var(--line)] bg-white hover:border-[var(--forest)] hover:bg-[var(--mint)]/40"
                    }`}
                  >
                    <span className="block font-bold">{slot}</span>
                    <span className="mt-1 block">₱{price}</span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--line)] bg-[var(--cream)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Selected</p>
          <p className="mt-1 text-lg font-black">
            {selected.length ? `${selected.length} hour${selected.length > 1 ? "s" : ""} · ₱${total.toLocaleString()}` : "Choose an available hour"}
          </p>
        </div>
        <button
          type="button"
          disabled={!selected.length}
          className="rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-bold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Continue to booking
        </button>
      </div>
    </div>
  );
}
