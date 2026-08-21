// =============================================================================
// POST /api/v1/auth/refresh — exchange a refresh token for a new access token
// =============================================================================
// The refresh token is opaque (not a JWT). Its SHA-256 hash is looked up in
// ApiToken. If found, not revoked, and not expired, we issue a fresh access
// token and stamp lastUsedAt on the refresh token.
//
// On revocation (device revoked / logout), the refresh token row gets
// revokedAt set and this endpoint returns 401 TOKEN_REVOKED.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  issueAccessToken,
  hashToken,
  accessTokenTtlSeconds,
} from "@/lib/api/tokens";
import {
  apiSuccess,
  apiValidationError,
  apiUnauthorized,
  apiError,
  ErrorCode,
  apiInternalError,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const RefreshSchema = z
  .object({
    refreshToken: z.string().min(10, "refreshToken is required"),
  })
  .strict();

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, RefreshSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { refreshToken } = parsed.data;

  try {
    const tokenRow = await db.apiToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: {
        device: { select: { id: true, revokedAt: true } },
      },
    });

    if (!tokenRow || tokenRow.kind !== "refresh") {
      return apiUnauthorized("Invalid refresh token");
    }

    // Check revocation
    if (tokenRow.revokedAt) {
      return apiError(
        ErrorCode.TOKEN_REVOKED,
        "Refresh token has been revoked",
        401
      );
    }
    if (tokenRow.device?.revokedAt) {
      return apiError(
        ErrorCode.DEVICE_REVOKED,
        "This device has been revoked",
        401
      );
    }

    // Check expiry
    if (tokenRow.expiresAt <= new Date()) {
      return apiError(
        ErrorCode.TOKEN_EXPIRED,
        "Refresh token has expired — please re-authenticate",
        401
      );
    }

    // Issue a new access token
    const accessToken = issueAccessToken(
      tokenRow.userId,
      tokenRow.deviceId ?? undefined
    );
    if (!accessToken) {
      return apiInternalError("Server is not configured for native authentication");
    }

    // Stamp lastUsedAt
    await db.apiToken.update({
      where: { id: tokenRow.id },
      data: { lastUsedAt: new Date() },
    });

    // Also bump the device's lastSeenAt
    if (tokenRow.deviceId) {
      await db.device.update({
        where: { id: tokenRow.deviceId },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    }

    return apiSuccess({
      accessToken,
      tokenType: "Bearer",
      expiresIn: accessTokenTtlSeconds(),
    });
  } catch (err) {
    console.error("[auth/refresh] error:", err);
    return apiInternalError();
  }
}
