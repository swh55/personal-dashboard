// =============================================================================
// POST /api/v1/auth/logout — revoke a refresh token and/or device
// =============================================================================
// Body (any of):
//   { refreshToken: "..." }     — revoke just this one refresh token
//   { allDevices: true }        — revoke ALL the user's devices + tokens
//   { deviceId: "..." }         — revoke a specific device + its tokens
//
// Requires a valid access token (bearer) or cookie session.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/api/tokens";
import { requirePrincipal } from "@/lib/api/auth-v1";
import {
  apiSuccess,
  apiValidationError,
  apiInternalError,
  apiNoContent,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const LogoutSchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
    deviceId: z.string().min(1).optional(),
    allDevices: z.boolean().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const parsed = await parseBody(req, LogoutSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { refreshToken, deviceId, allDevices } = parsed.data;

  try {
    if (allDevices) {
      // Revoke every device for this user (cascades to all ApiTokens).
      await db.device.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Also revoke any orphan tokens (no device).
      await db.apiToken.updateMany({
        where: { userId, revokedAt: null, deviceId: null },
        data: { revokedAt: new Date() },
      });
      return apiSuccess({ revoked: "all-devices" });
    }

    if (deviceId) {
      await db.device.updateMany({
        where: { userId, id: deviceId },
        data: { revokedAt: new Date() },
      });
      return apiSuccess({ revoked: "device", deviceId });
    }

    if (refreshToken) {
      await db.apiToken.updateMany({
        where: { userId, tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return apiSuccess({ revoked: "token" });
    }

    // No target supplied — just invalidate the calling bearer token's device.
    if (pr.principal.deviceId) {
      await db.device.update({
        where: { id: pr.principal.deviceId },
        data: { revokedAt: new Date() },
      });
      return apiSuccess({ revoked: "calling-device" });
    }

    return apiNoContent();
  } catch (err) {
    console.error("[auth/logout] error:", err);
    return apiInternalError();
  }
}
