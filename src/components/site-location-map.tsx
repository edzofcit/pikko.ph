"use client";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

export function SiteLocationMap({ latitude, longitude, siteName, address, tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png" }: {
  latitude: string;
  longitude: string;
  siteName: string;
  address: string;
  tileUrl?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!containerRef.current || mapRef.current || !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) return;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false }).setView([parsedLatitude, parsedLongitude], 16);
      leaflet.tileLayer(tileUrl, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap contributors</a>', maxZoom: 19 }).addTo(map);
      const icon = leaflet.divIcon({ className: "pikko-map-marker", html: '<span aria-hidden="true"></span>', iconAnchor: [14, 28], iconSize: [28, 28] });
      leaflet.marker([parsedLatitude, parsedLongitude], { icon, keyboard: false }).addTo(map).bindTooltip(siteName, { direction: "top", offset: [0, -24] });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, siteName, tileUrl]);

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-white" aria-labelledby="venue-location-heading">
      <div className="px-5 py-4 sm:px-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">Venue location</p><h2 id="venue-location-heading" className="mt-1 text-lg font-black">{siteName}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{address}</p></div>
      <div ref={containerRef} role="region" aria-label={`Map showing ${siteName} at ${address}`} className="h-72 w-full border-t border-[var(--line)] bg-slate-100 sm:h-96" />
    </section>
  );
}
