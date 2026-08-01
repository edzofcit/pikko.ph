import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pikko.ph",
    timestamp: new Date().toISOString(),
  });
}
