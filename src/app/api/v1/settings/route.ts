// =============================================================================
// /api/v1/settings — per-user key/value settings
// =============================================================================
// GET  /api/v1/settings       — return all settings (secrets are masked)
// PUT  /api/v1/settings       — upsert one or more settings { updates: { key: value } }
//
// Security: sensitive keys (aiApiKey, pinCode) are MASKED in GET responses
// (returned as "••••••••" if set, "" if unset). They can be written via PUT
// but never read back in full. This prevents the browser bundle from
// exfiltrating the user's AI API key or PIN.
//
// Whitelisted keys (matching the existing /api/appearance route):
//   theme, accent, username, pinEnabled, pinCode, city, lat, lng, timezone,
//   exchangeRate, aiApiKey, aiModel, aiBaseUrl

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import {
  apiSuccess,
  apiValidationError,
  apiInternalError,
  apiBadRequest,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

// Keys that are sensitive — masked in GET responses.
const SENSITIVE_KEYS = new Set(["aiApiKey", "pinCode"]);

// Whitelisted setting keys.
const ALLOWED_KEYS = new Set([
  "theme",
  "accent",
  "username",
  "pinEnabled",
  "pinCode",
  "city",
  "lat",
  "lng",
  "timezone",
  "exchangeRate",
  "aiApiKey",
  "aiModel",
  "aiBaseUrl",
]);

const SettingsUpdateSchema = z
  .object({
    updates: z.record(z.string(), z.string()).refine(
      (obj) => Object.keys(obj).every((k) => ALLOWED_KEYS.has(k)),
      { message: "One or more setting keys are not allowed" }
    ),
  })
  .strict();

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  try {
    const rows = await db.appSetting.findMany({
      where: { userId },
      select: { key: true, value: true },
    });
    const settings: Record<string, string> = {};
    for (const row of rows) {
      // Mask sensitive keys — client sees a placeholder, never the real value.
      if (SENSITIVE_KEYS.has(row.key) && row.value) {
        settings[row.key] = "••••••••";
      } else {
        settings[row.key] = row.value;
      }
    }
    return apiSuccess(settings);
  } catch (err) {
    console.error("[v1:settings] GET error:", err);
    return apiInternalError();
  }
}

export async function PUT(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const parsed = await parseBody(req, SettingsUpdateSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { updates } = parsed.data;

  // Skip empty placeholder values for sensitive keys (client sending back the mask).
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (SENSITIVE_KEYS.has(k) && (v === "••••••••" || v === "")) {
      // Don't overwrite the stored secret with the mask placeholder.
      continue;
    }
    filtered[k] = v;
  }

  if (Object.keys(filtered).length === 0) {
    return apiSuccess({ updated: 0 });
  }

  try {
    await db.$transaction(
      Object.entries(filtered).map(([key, value]) =>
        db.appSetting.upsert({
          where: { userId_key: { userId, key } },
          update: { value },
          create: { userId, key, value },
        })
      )
    );
    return apiSuccess({ updated: Object.keys(filtered).length });
  } catch (err) {
    console.error("[v1:settings] PUT error:", err);
    return apiInternalError();
  }
}
