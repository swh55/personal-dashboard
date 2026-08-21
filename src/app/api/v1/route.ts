// =============================================================================
// GET /api/v1 — API root / discovery
// =============================================================================
// Returns metadata about the API: version, base URL, available domains, and
// links to documentation. Useful for clients probing the server.

import { NextResponse } from "next/server";
import { SYNC_ENTITIES } from "@/lib/api/sync";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      name: "Silah Cloud Platform API",
      version: "v1",
      description: "Production REST API for the Silah personal dashboard — consumed by the web app and future native (Android / Windows / iOS) clients.",
      baseUrl: "/api/v1",
      authentication: {
        web: "NextAuth cookie session (automatic for the web app)",
        native: "Bearer access token from POST /api/v1/auth/token (Google ID token exchange)",
        docs: "See /docs/API.md for the full authentication flow.",
      },
      sync: {
        enabled: true,
        pullEndpoint: "GET /api/v1/sync/pull?cursor=<seq>",
        pushEndpoint: "POST /api/v1/sync/push",
        statusEndpoint: "GET /api/v1/sync/status",
        syncEnabledEntities: SYNC_ENTITIES.map((e) => e.plural),
      },
      domains: [
        "auth", "tasks", "contacts", "events", "notes", "expenses",
        "accounts", "assets", "debts", "budgets", "projects", "meetings",
        "habits", "medications", "diary", "occasions", "locations", "pantry",
        "waiting-list", "reminders", "scheduled-messages", "automation",
        "suggestions", "integrations", "activity", "recycle-bin", "settings",
        "devices", "sync", "health",
      ],
      links: {
        self: "/api/v1",
        health: "/api/v1/health",
        docs: "/docs/API.md",
        openapi: "/docs/openapi.json",
      },
    },
  });
}
