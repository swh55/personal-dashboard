// =============================================================================
// GET /api/v1/auth/me — current authenticated user
// =============================================================================
// Works with both bearer token (native) and cookie session (web).
// Returns the user's profile. Never returns secrets (no password hash, no
// tokens, no internal fields).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { apiSuccess, apiInternalError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, authMethod, deviceId } = pr.principal;

  try {
    // For cookie callers we already have the email; for bearer callers we
    // need a DB lookup. Always read from DB to get the freshest profile.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        provider: true,
        createdAt: true,
      },
    });
    if (!user) {
      return apiSuccess(null);
    }

    // Attach auth-context metadata so native clients know their session shape.
    return apiSuccess({
      ...user,
      authMethod,
      deviceId: deviceId ?? null,
    });
  } catch (err) {
    console.error("[auth/me] error:", err);
    return apiInternalError();
  }
}
