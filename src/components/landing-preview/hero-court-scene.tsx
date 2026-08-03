"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type PointerEvent } from "react";

type SceneCourt = {
  id: string;
  name: string;
  availableSlotCount: number;
};

export function HeroCourtScene({
  venueName,
  venueHref,
  location,
  coverUrl,
  courts,
  nextAvailableLabel,
  availableSlotCount,
  sceneVariant = "equipment",
}: {
  venueName: string;
  venueHref: string;
  location: string;
  coverUrl: string | null;
  courts: SceneCourt[];
  nextAvailableLabel: string | null;
  availableSlotCount: number;
  sceneVariant?: "equipment" | "rally";
}) {
  const sceneRef = useRef<HTMLDivElement>(null);

  function updatePerspective(event: PointerEvent<HTMLDivElement>) {
    const element = sceneRef.current;
    if (!element) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.cssText = [
      `--scene-x:${x * 6}deg`,
      `--scene-y:${y * -5}deg`,
      `--scene-near-x:${x * 20}px`,
      `--scene-near-y:${y * 16}px`,
      `--scene-mid-x:${x * 12}px`,
      `--scene-mid-y:${y * 10}px`,
      `--scene-far-x:${x * -7}px`,
      `--scene-far-y:${y * -5}px`,
    ].join(";");
  }

  function resetPerspective() {
    const element = sceneRef.current;
    if (!element) return;
    element.style.cssText = [
      "--scene-x:0deg",
      "--scene-y:0deg",
      "--scene-near-x:0px",
      "--scene-near-y:0px",
      "--scene-mid-x:0px",
      "--scene-mid-y:0px",
      "--scene-far-x:0px",
      "--scene-far-y:0px",
    ].join(";");
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
          {sceneVariant === "rally" ? (
            <div className="pikko-scene-rally">
              <span className="pikko-scene-player pikko-scene-player-away" />
              <span className="pikko-scene-player pikko-scene-player-home" />
              <span className="pikko-scene-live-ball" />
            </div>
          ) : null}
        </div>
        {sceneVariant === "equipment" ? (
          <div className="pikko-scene-equipment" aria-hidden="true">
            <div className="pikko-scene-ball" />
            <div className="pikko-scene-paddle">
              <span />
            </div>
          </div>
        ) : null}

        <Link
          href={`${venueHref}#availability`}
          aria-label={`Book at ${venueName}`}
          className="pikko-scene-card group absolute left-4 top-5 z-20 w-[min(15rem,calc(100%_-_2rem))] overflow-hidden rounded-[1.35rem] border border-white/20 bg-white/94 text-[var(--ink)] shadow-2xl backdrop-blur-xl outline-none ring-[var(--lime)] transition-[box-shadow,border-color] hover:border-[var(--lime)] hover:shadow-[0_28px_70px_rgb(0_0_0_/_38%)] focus-visible:ring-4 sm:left-8 sm:top-8"
        >
          <div className="relative h-20 overflow-hidden bg-[var(--forest)] sm:h-24">
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
            <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/50 px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
              <span className="size-2 rounded-full bg-[var(--lime)] shadow-[0_0_12px_var(--lime)]" /> Live now
            </span>
          </div>
          <div className="p-3.5">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-[var(--coral)]">Featured venue</p>
            <h2 className="mt-1 flex items-center gap-2 truncate text-lg font-black">
              <span className="truncate">{venueName}</span>
              <span aria-hidden="true" className="shrink-0 transition-transform group-hover:translate-x-1">→</span>
            </h2>
            <p className="mt-0.5 truncate text-[0.68rem] font-semibold text-[var(--text-muted)]">{location}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[var(--cream)] p-2.5">
                <span className="block text-[0.54rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Next open</span>
                <strong className="mt-1 block truncate text-xs">{nextAvailableLabel ?? "Another day"}</strong>
              </div>
              <div className="rounded-xl bg-[var(--mint)] p-2.5">
                <span className="block text-[0.54rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">Open slots</span>
                <strong className="mt-1 block text-xs">{availableSlotCount}</strong>
              </div>
            </div>
          </div>
        </Link>

        <div className="pikko-scene-status absolute bottom-5 right-5 z-30 w-[min(13.5rem,calc(100%_-_2.5rem))] rounded-[1.35rem] border border-white/15 bg-[#173c2a]/92 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-9 sm:right-10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/60">Court pulse</p>
            <span className="font-mono text-[0.62rem] text-[var(--lime)]">LIVE</span>
          </div>
          <div className="mt-3 space-y-2">
            {courts.slice(0, 3).map((court) => (
              <Link
                key={court.id}
                href={`${venueHref}#availability`}
                aria-label={`View booking availability for ${court.name} at ${venueName}`}
                className="group/court flex items-center justify-between gap-3 rounded-xl bg-white/8 px-3 py-2 outline-none ring-[var(--lime)] transition hover:bg-white/15 focus-visible:ring-2"
              >
                <span className="truncate text-xs font-bold">{court.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[0.6rem] font-black transition-transform group-hover/court:translate-x-0.5 ${court.availableSlotCount > 0 ? "bg-[var(--lime)] text-[var(--ink)]" : "bg-white/12 text-white/60"}`}>
                  {court.availableSlotCount > 0 ? `${court.availableSlotCount} open` : "Full"}
                </span>
              </Link>
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
