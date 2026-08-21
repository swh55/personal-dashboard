// =============================================================================
// POST /api/v1/auth/token — exchange a Google ID token for Silah API tokens
// =============================================================================
// Native flow (Android / Windows / iOS):
//
//   1. App uses the platform Google Sign-In SDK to obtain a Google ID token.
//   2. App POSTs { idToken, deviceId, platform, appVersion } here.
//   3. Server verifies the ID token with Google, finds/creates the Silah User,
//      registers a Device, and issues:
//        - accessToken  (stateless JWT, 15 min TTL)
//        - refreshToken (opaque, hash-stored, 30 day TTL)
//   4. App stores both tokens securely and sends `Authorization: Bearer
//      <accessToken>` on every subsequent API call.
//   5. When the access token expires, app calls /api/v1/auth/refresh.
//
// This endpoint never touches the NextAuth cookie session — native and web
// sessions are fully independent.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  issueAccessToken,
  generateRefreshToken,
  hashToken,
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
} from "@/lib/api/tokens";
import { apiSuccess, apiValidationError, apiInternalError, apiBadRequest } from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const TokenSchema = z
  .object({
    idToken: z.string().min(10, "Google ID token is required"),
    deviceId: z.string().min(1).max(200).optional(),
    deviceName: z.string().max(200).optional(),
    platform: z.enum(["android", "windows", "ios", "web", "other"]).optional(),
    appVersion: z.string().max(100).optional(),
  })
  .strict();

interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  exp: number;
}

/**
 * Verify a Google ID token by calling Google's tokeninfo endpoint.
 * Returns the verified payload or null. We use the network endpoint (rather
 * than local JWT verification) so we always honour Google's latest key
 * rotations and revocations without shipping a JWKS client.
 */
async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdTokenPayload | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { method: "GET", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as GoogleIdTokenPayload;

    // Verify the audience matches our Google client ID (prevents token reuse
    // from another app that also uses Google Sign-In).
    const expectedAudience = process.env.GOOGLE_CLIENT_ID;
    if (expectedAudience && payload.aud !== expectedAudience) {
      console.warn(
        "[auth/token] Google ID token audience mismatch — rejecting."
      );
      return null;
    }

    // Verify issuer
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      return null;
    }

    // Verify not expired
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;

    // Require a verified email
    if (!payload.email || payload.email_verified === false) return null;

    return payload;
  } catch (err) {
    console.error("[auth/token] Google ID token verification failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, TokenSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { idToken, deviceId, deviceName, platform, appVersion } = parsed.data;

  // --- 1. Verify the Google ID token ---
  const googleUser = await verifyGoogleIdToken(idToken);
  if (!googleUser) {
    return apiBadRequest("Invalid or expired Google ID token");
  }

  try {
    // --- 2. Find or create the Silah user (same upsert as NextAuth signIn) ---
    let user = await db.user.findUnique({
      where: { email: googleUser.email },
      select: { id: true, email: true, name: true, image: true, provider: true },
    });
    if (!user) {
      user = await db.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name ?? null,
          image: googleUser.picture ?? null,
          provider: "google",
        },
        select: { id: true, email: true, name: true, image: true, provider: true },
      });
    } else if (!user.provider) {
      user = await db.user.update({
        where: { id: user.id },
        data: { provider: "google", image: googleUser.picture ?? user.image },
        select: { id: true, email: true, name: true, image: true, provider: true },
      });
    }

    // --- 3. Register / update the device ---
    const ua = req.headers.get("user-agent") ?? undefined;
    let device = null;
    if (deviceId) {
      device = await db.device.upsert({
        where: {
          userId_deviceId: { userId: user.id, deviceId },
        },
        update: {
          name: deviceName ?? "Unnamed device",
          platform: platform ?? "unknown",
          appVersion: appVersion ?? null,
          userAgent: ua,
          lastSeenAt: new Date(),
          revokedAt: null, // un-revoke on re-login
        },
        create: {
          userId: user.id,
          deviceId,
          name: deviceName ?? "Unnamed device",
          platform: platform ?? "unknown",
          appVersion: appVersion ?? null,
          userAgent: ua,
        },
        select: { id: true },
      });
    }

    // --- 4. Issue access + refresh tokens ---
    const accessToken = issueAccessToken(user.id, device?.id);
    if (!accessToken) {
      console.error("[auth/token] AUTH_SECRET not configured — cannot issue token");
      return apiInternalError("Server is not configured for native authentication");
    }

    const rawRefresh = generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + refreshTokenTtlSeconds() * 1000);
    await db.apiToken.create({
      data: {
        userId: user.id,
        deviceId: device?.id ?? null,
        kind: "refresh",
        tokenHash: hashToken(rawRefresh),
        label: deviceName ?? platform ?? "native-client",
        scopes: "read,write",
        expiresAt: refreshExpiresAt,
      },
    });

    return apiSuccess({
      accessToken,
      refreshToken: rawRefresh,
      tokenType: "Bearer",
      expiresIn: accessTokenTtlSeconds(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        provider: user.provider,
      },
    });
  } catch (err) {
    console.error("[auth/token] error:", err);
    return apiInternalError();
  }
}
