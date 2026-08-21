// =============================================================================
// GET /api/v1/health — service health check
// =============================================================================
// Returns:
//   - status: "ok" | "degraded"
//   - version: API version string
//   - timestamp: server time
//   - services: { database: "ok"|"down" }
//
// Does NOT expose: connection strings, internal hostnames, env var values,
// or any secret. Safe to call unauthenticated.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const API_VERSION = "v1";

export async function GET() {
  const start = Date.now();
  let dbStatus: "ok" | "down" = "ok";

  try {
    // Lightweight DB probe — a raw SELECT 1.
    await db.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("[health] DB probe failed:", err);
    dbStatus = "down";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const latencyMs = Date.now() - start;

  return NextResponse.json(
    {
      success: true,
      data: {
        status,
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        latencyMs,
        services: { database: dbStatus },
      },
    },
    { status: status === "ok" ? 200 : 503 }
  );
}
