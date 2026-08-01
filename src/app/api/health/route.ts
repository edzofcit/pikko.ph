import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);

    return NextResponse.json({
      status: "ok",
      service: "pikko.ph",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);

    return NextResponse.json(
      {
        status: "unavailable",
        service: "pikko.ph",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
