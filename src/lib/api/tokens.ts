// =============================================================================
// v1 API — token generation, signing, and hashing
// =============================================================================
// Native clients authenticate with two kinds of tokens:
//
//   1. Access token  — a stateless JWT (short-lived, 15 min). Verified by
//      signature only; no DB lookup per request. Contains { sub, deviceId,
//      kind, iat, exp }.
//
//   2. Refresh token — an opaque random string (long-lived, 30 days). The
//      SHA-256 hash is stored in ApiToken so a DB leak doesn't expose live
//      sessions. Used to mint new access tokens via /auth/refresh.
//
// Revocation model:
//   - Revoke a Device → cascades to all its ApiTokens → no new access tokens
//     can be minted for that device. Existing access tokens expire naturally
//     within ≤15 min (the access-token TTL).
//   - Logout (single device) → revoke that device's refresh token only.
//   - Logout (all devices) → revoke the user's Device row(s).
//
// Signing key: AUTH_SECRET (shared with NextAuth). If AUTH_SECRET is unset,
// token issuance fails closed (returns null) — the auth endpoints will
// return 500 with a clear server log.

import crypto from "node:crypto";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

const ISSUER = "silah-cloud";
const AUDIENCE = "silah-api-v1";

// ---------------------------------------------------------------------------
// Secret resolution
// ---------------------------------------------------------------------------
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[tokens] FATAL: AUTH_SECRET is missing or too short (<16 chars). " +
          "Native API authentication will not work."
      );
    }
    return "";
  }
  return s;
}

// ---------------------------------------------------------------------------
// Minimal JWT implementation (HS256) — no external dependency
// ---------------------------------------------------------------------------
// We sign with HMAC-SHA256 using AUTH_SECRET. This is compatible with any
// standard JWT library on Android (Kotlin), Windows (C#), iOS (Swift), etc.

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export interface AccessTokenPayload {
  sub: string; // userId
  deviceId?: string;
  kind: "access";
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

function signJwt(payload: Record<string, unknown>): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, iss: ISSUER, aud: AUDIENCE };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const data = `${encHeader}.${encPayload}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest();
  const actualSig = base64UrlDecode(encSig);
  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;
  let payload: AccessTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encPayload).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
  if (payload.kind !== "access") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// Access token issuance
// ---------------------------------------------------------------------------
export function issueAccessToken(userId: string, deviceId?: string): string | null {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    sub: userId,
    deviceId,
    kind: "access",
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function accessTokenTtlSeconds(): number {
  return ACCESS_TOKEN_TTL_SECONDS;
}

// ---------------------------------------------------------------------------
// Refresh token generation + hashing
// ---------------------------------------------------------------------------
// The raw refresh token is returned to the client exactly once. Only the
// SHA-256 hash is persisted in ApiToken.tokenHash.

export function generateRefreshToken(): string {
  // 32 bytes of entropy → 43 base64url chars. Sufficient for a session token.
  return base64UrlEncode(crypto.randomBytes(32));
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenTtlSeconds(): number {
  return REFRESH_TOKEN_TTL_SECONDS;
}

export function refreshTokenTtlDays(): number {
  return REFRESH_TOKEN_TTL_DAYS;
}

// ---------------------------------------------------------------------------
// Device-ID generation (client-supplied, but we can generate a fallback)
// ---------------------------------------------------------------------------
export function generateDeviceId(): string {
  return crypto.randomUUID();
}
