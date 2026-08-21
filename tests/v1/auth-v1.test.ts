// =============================================================================
// Tests: src/lib/api/auth-v1.ts — dual authentication resolution
// =============================================================================
// Verifies:
//   - Bearer token with valid JWT → principal with authMethod="bearer"
//   - Bearer token with invalid JWT → 401 TOKEN_EXPIRED
//   - No auth header + no session → 401 UNAUTHORIZED
//   - Cookie session → principal with authMethod="cookie"
//   - Bearer token with revoked device → 401 DEVICE_REVOKED
//
// Mocks:
//   - @/lib/auth-helpers getCurrentUser (for cookie session path)
//   - @/lib/db db.device.findUnique (for device revocation check)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Mock setup using vi.hoisted so mocks can reference shared fns ---
const { mockGetCurrentUser, mockDeviceFindUnique } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDeviceFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    device: {
      findUnique: mockDeviceFindUnique,
    },
  },
}));

import { resolvePrincipal, assertOwnership } from "@/lib/api/auth-v1";
import { issueAccessToken } from "@/lib/api/tokens";
import { ErrorCode } from "@/lib/api/response";

const TEST_SECRET = "test-auth-secret-at-least-16-chars-long";
const USER_ID = "user-123";
const DEVICE_ID = "device-abc";

function makeBearerReq(token: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/tasks", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makeNoAuthReq(): NextRequest {
  return new NextRequest("http://localhost/api/v1/tasks");
}

describe("auth-v1 — resolvePrincipal", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET;
    mockGetCurrentUser.mockReset();
    mockDeviceFindUnique.mockReset();
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  // -------------------------------------------------------------------------
  // Bearer token path (native clients)
  // -------------------------------------------------------------------------
  describe("bearer token (native client)", () => {
    it("returns principal with authMethod=bearer for a valid token", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      // Device is active (not revoked).
      mockDeviceFindUnique.mockResolvedValue({
        id: DEVICE_ID,
        revokedAt: null,
        userId: USER_ID,
      });

      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.principal.userId).toBe(USER_ID);
        expect(result.principal.authMethod).toBe("bearer");
        expect(result.principal.deviceId).toBe(DEVICE_ID);
        expect(result.principal.email).toBe("");
      }
      expect(mockDeviceFindUnique).toHaveBeenCalledWith({
        where: { id: DEVICE_ID },
        select: { id: true, revokedAt: true, userId: true },
      });
    });

    it("returns 401 TOKEN_EXPIRED for an invalid/tampered token", async () => {
      const result = await resolvePrincipal(
        makeBearerReq("garbage.not-a-jwt")
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.TOKEN_EXPIRED);
      }
      // Device lookup should NOT have been called (token verification failed first).
      expect(mockDeviceFindUnique).not.toHaveBeenCalled();
    });

    it("returns 401 TOKEN_EXPIRED for a tampered signature", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      const parts = token.split(".");
      // Tamper with the signature — change the FIRST character (all 6 bits
      // are significant in the first char, so this always changes byte 0).
      const firstChar = parts[2][0];
      const replacement = firstChar === "A" ? "B" : "A";
      const tampered = `${parts[0]}.${parts[1]}.${replacement}${parts[2].slice(1)}`;

      const result = await resolvePrincipal(makeBearerReq(tampered));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.TOKEN_EXPIRED);
      }
    });

    it("returns 401 DEVICE_REVOKED when device is revoked", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      mockDeviceFindUnique.mockResolvedValue({
        id: DEVICE_ID,
        revokedAt: new Date("2024-01-01"), // revoked
        userId: USER_ID,
      });

      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.DEVICE_REVOKED);
      }
    });

    it("returns 401 DEVICE_REVOKED when device does not exist", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      mockDeviceFindUnique.mockResolvedValue(null);

      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.DEVICE_REVOKED);
      }
    });

    it("returns 401 UNAUTHORIZED when device.userId != token.sub", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      mockDeviceFindUnique.mockResolvedValue({
        id: DEVICE_ID,
        revokedAt: null,
        userId: "different-user", // mismatch
      });

      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      }
    });

    it("works without a deviceId in the token (skips device check)", async () => {
      const token = issueAccessToken(USER_ID)!; // no deviceId
      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.principal.userId).toBe(USER_ID);
        expect(result.principal.authMethod).toBe("bearer");
        expect(result.principal.deviceId).toBeUndefined();
      }
      expect(mockDeviceFindUnique).not.toHaveBeenCalled();
    });

    it("is case-insensitive for the 'Bearer' prefix", async () => {
      const token = issueAccessToken(USER_ID)!;
      const req = new NextRequest("http://localhost/api/v1/tasks", {
        headers: { Authorization: `bearer ${token}` },
      });

      const result = await resolvePrincipal(req);
      expect(result.ok).toBe(true);
    });

    it("returns 401 TOKEN_EXPIRED for 'Bearer' with invalid token content", async () => {
      const req = new NextRequest("http://localhost/api/v1/tasks", {
        headers: { Authorization: "Bearer not-a-real-jwt" },
      });

      const result = await resolvePrincipal(req);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.TOKEN_EXPIRED);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Cookie session path (web app)
  // -------------------------------------------------------------------------
  describe("cookie session (web app)", () => {
    it("returns principal with authMethod=cookie for a valid session", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: USER_ID,
        email: "user@example.com",
        name: "Test User",
        image: null,
        provider: "google",
      });

      const result = await resolvePrincipal(makeNoAuthReq());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.principal.userId).toBe(USER_ID);
        expect(result.principal.email).toBe("user@example.com");
        expect(result.principal.authMethod).toBe("cookie");
        expect(result.principal.deviceId).toBeUndefined();
      }
    });

    it("returns 401 UNAUTHORIZED when getCurrentUser returns null", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await resolvePrincipal(makeNoAuthReq());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      }
    });
  });

  // -------------------------------------------------------------------------
  // No auth at all
  // -------------------------------------------------------------------------
  describe("no authentication", () => {
    it("returns 401 UNAUTHORIZED when no auth header and no session", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await resolvePrincipal(makeNoAuthReq());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      }
    });

    it("falls back to cookie session when Authorization header is not Bearer", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: USER_ID,
        email: "user@example.com",
        name: null,
        image: null,
        provider: "google",
      });

      const req = new NextRequest("http://localhost/api/v1/tasks", {
        headers: { Authorization: "Basic abc123" },
      });

      const result = await resolvePrincipal(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.principal.authMethod).toBe("cookie");
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe("error handling", () => {
    it("returns 500 INTERNAL_ERROR when device lookup throws", async () => {
      const token = issueAccessToken(USER_ID, DEVICE_ID)!;
      mockDeviceFindUnique.mockRejectedValue(new Error("DB connection lost"));

      const result = await resolvePrincipal(makeBearerReq(token));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
        const body = await result.response.json();
        expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      }
    });

    it("returns 500 INTERNAL_ERROR when getCurrentUser throws", async () => {
      mockGetCurrentUser.mockRejectedValue(new Error("Session error"));

      const result = await resolvePrincipal(makeNoAuthReq());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(500);
      }
    });
  });
});

describe("assertOwnership", () => {
  it("returns null when principal owns the record", () => {
    const principal = {
      userId: "user-1",
      email: "",
      authMethod: "bearer" as const,
    };
    const result = assertOwnership(principal, "user-1");
    expect(result).toBeNull();
  });

  it("returns 404 when record belongs to a different user", () => {
    const principal = {
      userId: "user-1",
      email: "",
      authMethod: "bearer" as const,
    };
    const result = assertOwnership(principal, "user-2");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(404);
  });

  it("returns 404 when recordUserId is null", () => {
    const principal = {
      userId: "user-1",
      email: "",
      authMethod: "bearer" as const,
    };
    const result = assertOwnership(principal, null);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(404);
  });

  it("returns 404 when recordUserId is undefined", () => {
    const principal = {
      userId: "user-1",
      email: "",
      authMethod: "bearer" as const,
    };
    const result = assertOwnership(principal, undefined);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(404);
  });

  it("returns 404 (not 403) to avoid leaking existence", () => {
    const principal = {
      userId: "user-1",
      email: "",
      authMethod: "bearer" as const,
    };
    const result = assertOwnership(principal, "other-user");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(404);
  });
});
