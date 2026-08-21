// =============================================================================
// v1 API — dual authentication: cookie session (web) OR bearer token (native)
// =============================================================================
// This is the single entry point for resolving "who is calling this API" in
// the /api/v1/* layer. It supports two authentication mechanisms:
//
//   1. Cookie session  — the existing NextAuth JWT cookie used by the web app.
//      This means the web app can call /api/v1/* routes without any changes.
//
//   2. Bearer token    — `Authorization: Bearer <access-token>` for native
//      clients (Android / Windows / iOS). The token is a stateless HS256 JWT.
//
// The resolved principal is always a server-verified `userId`. We NEVER trust
// a userId supplied in the request body, query string, or headers.
//
// Ownership enforcement (per-record userId comparison) happens in the CRUD
// factory / individual routes — this module only answers "who is the caller?".

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { verifyAccessToken } from "./tokens";
import {
  apiUnauthorized,
  ErrorCode,
  apiError,
  apiInternalError,
} from "./response";

export interface ApiPrincipal {
  userId: string;
  email: string;
  /** How the caller authenticated — useful for audit logs. */
  authMethod: "cookie" | "bearer";
  /** Present only for bearer-token (native) callers. */
  deviceId?: string;
}

export type PrincipalResult =
  | { ok: true; principal: ApiPrincipal }
  | { ok: false; response: NextResponse };

/**
 * Resolve the authenticated principal from the request.
 *
 * Tries the Authorization Bearer header first (native), then falls back to
 * the NextAuth cookie session (web). Returns a 401 response if neither yields
 * a valid user.
 */
export async function resolvePrincipal(
  req: NextRequest
): Promise<PrincipalResult> {
  // --- 1. Try bearer token (native client) ---
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    const payload = verifyAccessToken(raw);
    if (!payload) {
      return {
        ok: false,
        response: apiError(
          ErrorCode.TOKEN_EXPIRED,
          "Access token is invalid or expired",
          401
        ),
      };
    }
    // Verify the device is not revoked (single indexed lookup).
    if (payload.deviceId) {
      try {
        const device = await db.device.findUnique({
          where: { id: payload.deviceId },
          select: { id: true, revokedAt: true, userId: true },
        });
        if (!device || device.revokedAt) {
          return {
            ok: false,
            response: apiError(
              ErrorCode.DEVICE_REVOKED,
              "This device has been revoked. Please re-authenticate.",
              401
            ),
          };
        }
        if (device.userId !== payload.sub) {
          return {
            ok: false,
            response: apiUnauthorized("Token subject mismatch"),
          };
        }
      } catch (err) {
        console.error("[auth-v1] device lookup failed:", err);
        return { ok: false, response: apiInternalError() };
      }
    }
    return {
      ok: true,
      principal: {
        userId: payload.sub,
        email: "", // not needed for bearer callers; omit to avoid DB hit
        authMethod: "bearer",
        deviceId: payload.deviceId,
      },
    };
  }

  // --- 2. Fall back to NextAuth cookie session (web app) ---
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, response: apiUnauthorized() };
    }
    return {
      ok: true,
      principal: {
        userId: user.id,
        email: user.email,
        authMethod: "cookie",
      },
    };
  } catch (err) {
    console.error("[auth-v1] getCurrentUser failed:", err);
    return { ok: false, response: apiInternalError() };
  }
}

/**
 * Convenience wrapper: resolves the principal or returns the 401 response.
 * Usage:
 *   const pr = await requirePrincipal(req);
 *   if (!pr.ok) return pr.response;
 *   const { userId } = pr.principal;
 */
export async function requirePrincipal(req: NextRequest): Promise<PrincipalResult> {
  return resolvePrincipal(req);
}

/**
 * Ownership check helper. Returns null if the caller owns the record, or a
 * 403/404 response if they don't / it doesn't exist.
 *
 *   const check = await assertOwnership(req, existingUserId);
 *   if (check) return check;
 */
export function assertOwnership(
  principal: ApiPrincipal,
  recordUserId: string | null | undefined
): NextResponse | null {
  if (!recordUserId || recordUserId !== principal.userId) {
    // Return 404 (not 403) to avoid leaking the existence of other users' records
    return apiError(
      ErrorCode.NOT_FOUND,
      "Resource not found",
      404
    );
  }
  return null;
}
