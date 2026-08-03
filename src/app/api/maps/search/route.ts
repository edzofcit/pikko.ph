import { NextResponse } from "next/server";
import { getMerchantAccess } from "@/lib/auth/access";

export const runtime = "nodejs";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

let nextPublicSearchAt = 0;

async function waitForPublicSearchSlot() {
  const waitMs = Math.max(0, nextPublicSearchAt - Date.now());
  nextPublicSearchAt = Math.max(nextPublicSearchAt, Date.now()) + 1_100;
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

export async function GET(request: Request) {
  const access = await getMerchantAccess();
  if (!access?.user || !access.membership || !access.permissions.includes("manage_courts")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 200) {
    return NextResponse.json({ error: "Enter a location between 3 and 200 characters." }, { status: 400 });
  }

  const baseUrl = process.env.OSM_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
  const searchUrl = new URL(baseUrl);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("countrycodes", "ph");

  try {
    if (!process.env.OSM_GEOCODER_URL) await waitForPublicSearchSlot();
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        Referer: "https://pikko.ph/",
        "User-Agent": "Pikko.ph/1.0 (+https://pikko.ph; contact: support@pikko.ph)",
      },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
    const payload = (await response.json()) as NominatimResult[];
    const results = payload.flatMap((result) => {
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      if (!result.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{ displayName: result.display_name, latitude, longitude }];
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("OpenStreetMap location search failed", error);
    return NextResponse.json({ error: "Map search is temporarily unavailable. You can still enter coordinates manually." }, { status: 502 });
  }
}
