"use client";

import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  displayName: string;
  latitude: number;
  longitude: number;
};

type SiteLocationPickerProps = {
  initialLatitude?: string | null;
  initialLongitude?: string | null;
  initialSearch?: string;
  tileUrl?: string;
};

const PHILIPPINES_CENTER = { latitude: 12.8797, longitude: 121.774 };

function validCoordinate(latitude: number, longitude: number) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function SiteLocationPicker({
  initialLatitude,
  initialLongitude,
  initialSearch = "",
  tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
}: SiteLocationPickerProps) {
  const parsedInitialLatitude = Number(initialLatitude);
  const parsedInitialLongitude = Number(initialLongitude);
  const hasInitialLocation =
    initialLatitude !== null &&
    initialLatitude !== undefined &&
    initialLatitude !== "" &&
    initialLongitude !== null &&
    initialLongitude !== undefined &&
    initialLongitude !== "" &&
    Number.isFinite(parsedInitialLatitude) &&
    Number.isFinite(parsedInitialLongitude) &&
    validCoordinate(parsedInitialLatitude, parsedInitialLongitude);
  const [latitude, setLatitude] = useState(hasInitialLocation ? formatCoordinate(parsedInitialLatitude) : "");
  const [longitude, setLongitude] = useState(hasInitialLocation ? formatCoordinate(parsedInitialLongitude) : "");
  const [query, setQuery] = useState(initialSearch);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const setLocation = useCallback((nextLatitude: number, nextLongitude: number, recenter = true) => {
    if (!validCoordinate(nextLatitude, nextLongitude)) return;
    setLatitude(formatCoordinate(nextLatitude));
    setLongitude(formatCoordinate(nextLongitude));
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map) return;
    if (!markerRef.current) {
      const icon = leaflet.divIcon({
        className: "pikko-map-marker",
        html: "<span aria-hidden=\"true\"></span>",
        iconAnchor: [14, 28],
        iconSize: [28, 28],
      });
      markerRef.current = leaflet.marker([nextLatitude, nextLongitude], { draggable: true, icon }).addTo(map);
      markerRef.current.on("dragend", () => {
        const position = markerRef.current?.getLatLng();
        if (position) {
          setLatitude(formatCoordinate(position.lat));
          setLongitude(formatCoordinate(position.lng));
          setStatus("Pin moved. Save the site settings to keep this location.");
        }
      });
    } else {
      markerRef.current.setLatLng([nextLatitude, nextLongitude]);
    }
    if (recenter) map.setView([nextLatitude, nextLongitude], Math.max(map.getZoom(), 16));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    void import("leaflet").then((leaflet) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = leaflet;
      const center = hasInitialLocation
        ? { latitude: parsedInitialLatitude, longitude: parsedInitialLongitude }
        : PHILIPPINES_CENTER;
      const map = leaflet.map(containerRef.current, { scrollWheelZoom: false }).setView(
        [center.latitude, center.longitude],
        hasInitialLocation ? 16 : 5,
      );
      leaflet
        .tileLayer(tileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          maxZoom: 19,
        })
        .addTo(map);
      map.on("click", (event) => {
        setLocation(event.latlng.lat, event.latlng.lng, false);
        setStatus("Location pinned. Save the site settings to keep it.");
      });
      mapRef.current = map;
      if (hasInitialLocation) setLocation(parsedInitialLatitude, parsedInitialLongitude, false);
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      markerRef.current = null;
      leafletRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasInitialLocation, parsedInitialLatitude, parsedInitialLongitude, setLocation, tileUrl]);

  async function searchAddress() {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      setStatus("Enter at least three characters to search.");
      return;
    }
    setSearching(true);
    setStatus("");
    setResults([]);
    try {
      const response = await fetch(`/api/maps/search?q=${encodeURIComponent(normalizedQuery)}`);
      const payload = (await response.json()) as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Location search failed.");
      const nextResults = payload.results ?? [];
      setResults(nextResults);
      setStatus(nextResults.length ? `${nextResults.length} location${nextResults.length === 1 ? "" : "s"} found.` : "No matching locations found.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Location search failed.");
    } finally {
      setSearching(false);
    }
  }

  function applyManualCoordinates() {
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude) || !validCoordinate(nextLatitude, nextLongitude)) {
      setStatus("Enter a valid latitude and longitude.");
      return;
    }
    setStatus("Coordinates updated.");
    setLocation(nextLatitude, nextLongitude);
  }

  function clearLocation() {
    setLatitude("");
    setLongitude("");
    setResults([]);
    setStatus("Location cleared. Save the site settings to apply this change.");
    markerRef.current?.remove();
    markerRef.current = null;
  }

  const hasPinnedLocation = latitude !== "" && longitude !== "";

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 sm:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black">Pin the site location</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Search for the venue, then tap the map or drag the pin to the exact entrance.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[0.68rem] font-black ${hasPinnedLocation ? "bg-emerald-100 text-emerald-800" : "bg-white text-[var(--text-muted)]"}`}>
          {hasPinnedLocation ? "Pin set" : "No pin yet"}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="site-location-search">Search for a venue address</label>
        <input
          id="site-location-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchAddress();
            }
          }}
          placeholder="Search address or venue name"
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
        />
        <button type="button" disabled={searching} onClick={() => void searchAddress()} className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60">
          {searching ? "Searching…" : "Search map"}
        </button>
      </div>
      {results.length ? (
        <ul className="space-y-2" aria-label="Location search results">
          {results.map((result) => (
            <li key={`${result.latitude}-${result.longitude}-${result.displayName}`}>
              <button
                type="button"
                onClick={() => {
                  setLocation(result.latitude, result.longitude);
                  setResults([]);
                  setStatus("Location selected. Save the site settings to keep it.");
                }}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-left text-xs leading-5 hover:border-emerald-400"
              >
                {result.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <div ref={containerRef} role="region" className="h-80 overflow-hidden rounded-xl border border-[var(--line)] bg-slate-100" aria-label="OpenStreetMap location picker" />
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-[var(--ink)]/90 px-4 py-2 text-center text-[0.68rem] font-black text-white shadow-lg">
          Tap anywhere to drop the pin
        </div>
      </div>
      <details className="rounded-xl border border-[var(--line)] bg-white p-3">
        <summary className="cursor-pointer text-xs font-black text-[var(--forest)]">Advanced coordinates</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <label className="text-xs font-black">Latitude
            <input name="latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" placeholder="10.315700" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal" />
          </label>
          <label className="text-xs font-black">Longitude
            <input name="longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" placeholder="123.885400" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal" />
          </label>
          <button type="button" onClick={applyManualCoordinates} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black">Apply</button>
          <button type="button" onClick={clearLocation} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black text-[var(--text-muted)]">Clear pin</button>
        </div>
      </details>
      <p aria-live="polite" className="min-h-5 text-xs font-bold text-[var(--forest)]">{status}</p>
      <p className="text-[0.68rem] text-[var(--text-muted)]">
        Search and map data © OpenStreetMap contributors. Search runs only when you submit it.
      </p>
    </section>
  );
}
