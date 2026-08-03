"use client";

import Image from "next/image";
import { useRef, type PointerEvent } from "react";

type SceneCourt = {
  id: string;
  name: string;
  availableSlotCount: number;
};

export function HeroCourtScene({
  venueName,
  location,
  coverUrl,
  courts,
  nextAvailableLabel,
  availableSlotCount,
}: {
  venueName: string;
  location: string;
  coverUrl: string | null;
  courts: SceneCourt[];
  nextAvailableLabel: string | null;
  availableSlotCount: number;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);

  function updatePerspective(event: PointerEvent<HTMLDivElement>) {
    const element = sceneRef.current;
    if (!element) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.setProperty("--scene-x", `${x * 7}deg`);
    element.style.setProperty("--scene-y", `${y * -6}deg`);
  }

  function resetPerspective() {
    const element = sceneRef.current;
    if (!element) return;
    element.style.setProperty("--scene-x", "0deg");
    element.style.setProperty("--scene-y", "0deg");
  }

  return (
    <div
      className="pikko-scene-shell relative min-h-[28rem] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#102c20] sm:min-h-[35rem]"
      onPointerMove={updatePerspective}
      onPointerLeave={resetPerspective}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgb(245_255_61_/_18%),transparent_28rem)]" />
      <div className="noise absolute inset-0 opacity-25" />
      <div ref={sceneRef} className="pikko-scene absolute inset-0">
        <div className="pikko-scene-glow" />
        <div className="pikko-scene-court" aria-hidden="true">
          <span className="pikko-scene-line pikko-scene-line-center" />
          <span className="pikko-scene-line pikko-scene-line-left" />
          <span className="pikko-scene-line pikko-scene-line-right" />
          <span className="pikko-scene-net" />
        </div>
        <div className="pikko-scene-ball" aria-hidden="true" />
        <div className="pikko-scene-paddle" aria-hidden="true">
          <span />
        </div>

        <article className="pikko-scene-card absolute left-4 top-5 z-20 w-[min(18rem,calc(100%_-_2rem))] overflow-hidden rounded-3xl border border-white/20 bg-white/92 text-[var(--ink)] shadow-2xl backdrop-blur-xl sm:left-7 sm:top-8">
          <div className="relative h-28 overflow-hidden bg-[var(--forest)]">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt=""
                fill
                sizes="288px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#315f43,#173c2a)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
              <span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" /> Live now
            </span>
          </div>
          <div className="p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-[var(--coral)]">Featured venue</p>
            <h2 className="mt-1 truncate text-xl font-black">{venueName}</h2>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--text-muted)]">{location}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[var(--cream)] p-3">
                <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Next open</span>
                <strong className="mt-1 block text-sm">{nextAvailableLabel ?? "Check another day"}</strong>
              </div>
              <div className="rounded-2xl bg-[var(--mint)] p-3">
                <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Open slots</span>
                <strong className="mt-1 block text-sm">{availableSlotCount}</strong>
              </div>
            </div>
          </div>
        </article>

        <div className="pikko-scene-status absolute bottom-5 right-4 z-30 w-[min(15rem,calc(100%_-_2rem))] rounded-3xl border border-white/15 bg-[#173c2a]/88 p-4 text-white shadow-2xl backdrop-blur-xl sm:bottom-8 sm:right-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/60">Court pulse</p>
            <span className="font-mono text-[0.62rem] text-[var(--lime)]">LIVE</span>
          </div>
          <div className="mt-3 space-y-2">
            {courts.slice(0, 3).map((court) => (
              <div key={court.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/8 px-3 py-2">
                <span className="truncate text-xs font-bold">{court.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[0.6rem] font-black ${court.availableSlotCount > 0 ? "bg-[var(--lime)] text-[var(--ink)]" : "bg-white/12 text-white/60"}`}>
                  {court.availableSlotCount > 0 ? `${court.availableSlotCount} open` : "Full"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only">
        {venueName} has {availableSlotCount} currently available hourly slots.
      </p>
    </div>
  );
}
