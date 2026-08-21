// =============================================================================
// Tests: src/lib/api/tokens.ts — JWT access tokens + opaque refresh tokens
// =============================================================================
// Verifies:
//   - issueAccessToken produces a valid 3-part JWT
//   - verifyAccessToken returns the payload for a valid token
//   - verifyAccessToken returns null for tampered/expired/wrong-sig/malformed
//   - generateRefreshToken produces unique tokens
//   - hashToken is deterministic and produces a SHA-256 hex digest
//   - Token has correct claims (sub, deviceId, kind, iss, aud, exp)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import {
  issueAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
  refreshTokenTtlDays,
  generateDeviceId,
} from "@/lib/api/tokens";

const TEST_SECRET = "test-auth-secret-at-least-16-chars-long";

describe("tokens — environment", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.AUTH_SECRET;
  });

  describe("issueAccessToken", () => {
    it("produces a non-null string with 3 dot-separated parts", () => {
      const token = issueAccessToken("user-123");
      expect(token).not.toBeNull();
      expect(token!.split(".")).toHaveLength(3);
    });

    it("produces a token with a base64url header", () => {
      const token = issueAccessToken("user-123");
      const [header] = token!.split(".");
      const decoded = JSON.parse(
        Buffer.from(header.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );
      expect(decoded.alg).toBe("HS256");
      expect(decoded.typ).toBe("JWT");
    });

    it("returns null when AUTH_SECRET is missing", () => {
      delete process.env.AUTH_SECRET;
      const token = issueAccessToken("user-123");
      expect(token).toBeNull();
    });

    it("returns null when AUTH_SECRET is too short (<16 chars)", () => {
      process.env.AUTH_SECRET = "short";
      const token = issueAccessToken("user-123");
      expect(token).toBeNull();
    });
  });

  describe("verifyAccessToken — valid token", () => {
    it("returns the payload for a freshly issued token", () => {
      const token = issueAccessToken("user-123", "device-abc");
      expect(token).not.toBeNull();
      const payload = verifyAccessToken(token!);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe("user-123");
      expect(payload!.deviceId).toBe("device-abc");
      expect(payload!.kind).toBe("access");
    });

    it("includes iss claim", () => {
      const token = issueAccessToken("user-1");
      const payload = verifyAccessToken(token!);
      expect(payload!.iss).toBe("silah-cloud");
    });

    it("includes aud claim", () => {
      const token = issueAccessToken("user-1");
      const payload = verifyAccessToken(token!);
      expect(payload!.aud).toBe("silah-api-v1");
    });

    it("includes iat claim (seconds since epoch)", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = issueAccessToken("user-1");
      const after = Math.floor(Date.now() / 1000);
      const payload = verifyAccessToken(token!);
      expect(payload!.iat).toBeGreaterThanOrEqual(before);
      expect(payload!.iat).toBeLessThanOrEqual(after);
    });

    it("includes exp claim = iat + 15 minutes", () => {
      const token = issueAccessToken("user-1");
      const payload = verifyAccessToken(token!);
      expect(payload!.exp - payload!.iat).toBe(15 * 60);
    });

    it("works without a deviceId (undefined)", () => {
      const token = issueAccessToken("user-1");
      const payload = verifyAccessToken(token!);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe("user-1");
      expect(payload!.deviceId).toBeUndefined();
    });
  });

  describe("verifyAccessToken — invalid tokens", () => {
    it("returns null for a tampered payload", () => {
      const token = issueAccessToken("user-123")!;
      const parts = token.split(".");
      // Tamper with the payload — flip one character.
      const tamperedPayload =
        parts[1].slice(0, -1) + (parts[1].endsWith("A") ? "B" : "A");
      const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      expect(verifyAccessToken(tampered)).toBeNull();
    });

    it("returns null for a tampered signature", () => {
      const token = issueAccessToken("user-123")!;
      const parts = token.split(".");
      // Tamper with the signature — flip the last character.
      const last = parts[2].slice(-1);
      const flipped = last === "A" ? "B" : "A";
      const tamperedSig = parts[2].slice(0, -1) + flipped;
      const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
      expect(verifyAccessToken(tampered)).toBeNull();
    });

    it("returns null for an expired token", () => {
      vi.useFakeTimers();
      const token = issueAccessToken("user-123");
      // Advance past the 15-minute TTL.
      vi.advanceTimersByTime(16 * 60 * 1000);
      expect(verifyAccessToken(token!)).toBeNull();
    });

    it("returns null for a token signed with a different secret", () => {
      process.env.AUTH_SECRET = "first-secret-at-least-16-characters";
      const token = issueAccessToken("user-123");
      process.env.AUTH_SECRET = "second-secret-at-least-16-characters";
      expect(verifyAccessToken(token!)).toBeNull();
    });

    it("returns null for a malformed token (not 3 parts)", () => {
      expect(verifyAccessToken("not.a.jwt.extra")).toBeNull();
      expect(verifyAccessToken("onlyonepart")).toBeNull();
      expect(verifyAccessToken("two.parts")).toBeNull();
    });

    it("returns null for a completely garbage string", () => {
      expect(verifyAccessToken("garbage")).toBeNull();
      expect(verifyAccessToken("")).toBeNull();
    });

    it("returns null for a token with wrong iss", () => {
      // Manually craft a token with a bad iss.
      const secret = TEST_SECRET;
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(
        JSON.stringify({
          sub: "user-1",
          kind: "access",
          iat: now,
          exp: now + 900,
          iss: "wrong-issuer",
          aud: "silah-api-v1",
        })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const data = `${header}.${payload}`;
      const sig = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest()
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      expect(verifyAccessToken(`${data}.${sig}`)).toBeNull();
    });

    it("returns null for a token with wrong aud", () => {
      const secret = TEST_SECRET;
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(
        JSON.stringify({
          sub: "user-1",
          kind: "access",
          iat: now,
          exp: now + 900,
          iss: "silah-cloud",
          aud: "wrong-audience",
        })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const data = `${header}.${payload}`;
      const sig = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest()
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      expect(verifyAccessToken(`${data}.${sig}`)).toBeNull();
    });

    it("returns null for a token with wrong kind", () => {
      const secret = TEST_SECRET;
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(
        JSON.stringify({
          sub: "user-1",
          kind: "refresh", // not "access"
          iat: now,
          exp: now + 900,
          iss: "silah-cloud",
          aud: "silah-api-v1",
        })
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const data = `${header}.${payload}`;
      const sig = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest()
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      expect(verifyAccessToken(`${data}.${sig}`)).toBeNull();
    });
  });

  describe("generateRefreshToken", () => {
    it("produces a non-empty string", () => {
      const token = generateRefreshToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(20);
    });

    it("produces unique tokens across multiple calls", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken());
      }
      expect(tokens.size).toBe(100);
    });

    it("produces base64url-safe characters only", () => {
      const token = generateRefreshToken();
      // base64url alphabet: A-Z a-z 0-9 - _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("hashToken", () => {
    it("is deterministic — same input → same output", () => {
      const raw = "my-refresh-token-123";
      const h1 = hashToken(raw);
      const h2 = hashToken(raw);
      expect(h1).toBe(h2);
    });

    it("produces a 64-character hex string (SHA-256)", () => {
      const raw = "test-token";
      const hash = hashToken(raw);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("matches crypto.createHash('sha256') output", () => {
      const raw = "verify-against-node";
      const expected = crypto
        .createHash("sha256")
        .update(raw)
        .digest("hex");
      expect(hashToken(raw)).toBe(expected);
    });

    it("produces different hashes for different inputs", () => {
      expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
    });
  });

  describe("TTL accessors", () => {
    it("accessTokenTtlSeconds returns 900 (15 min)", () => {
      expect(accessTokenTtlSeconds()).toBe(15 * 60);
    });

    it("refreshTokenTtlSeconds returns 30 days in seconds", () => {
      expect(refreshTokenTtlSeconds()).toBe(30 * 24 * 60 * 60);
    });

    it("refreshTokenTtlDays returns 30", () => {
      expect(refreshTokenTtlDays()).toBe(30);
    });
  });

  describe("generateDeviceId", () => {
    it("produces a valid UUID", () => {
      const id = generateDeviceId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("produces unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        ids.add(generateDeviceId());
      }
      expect(ids.size).toBe(50);
    });
  });
});
