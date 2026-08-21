// =============================================================================
// Tests: src/lib/api/response.ts — unified response contract + error codes
// =============================================================================
// Verifies the { success, data } / { success, error } envelope, HTTP status
// codes for each error code, and the convenience wrappers.

import { describe, it, expect } from "vitest";
import {
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiList,
  apiError,
  apiBadRequest,
  apiValidationError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiConflict,
  apiRateLimited,
  apiMethodNotAllowed,
  apiInternalError,
  ErrorCode,
} from "@/lib/api/response";

describe("response helpers — success envelope", () => {
  it("apiSuccess returns 200 with { success: true, data }", async () => {
    const res = apiSuccess({ id: 1, name: "test" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: 1, name: "test" } });
  });

  it("apiSuccess respects custom status code", async () => {
    const res = apiSuccess({ ok: true }, 202);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("apiSuccess merges extra top-level keys", async () => {
    const res = apiSuccess({ id: 1 }, 200, { meta: { count: 1 } });
    const body = await res.json();
    expect(body.meta).toEqual({ count: 1 });
    expect(body.data).toEqual({ id: 1 });
  });

  it("apiCreated returns 201", async () => {
    const res = apiCreated({ id: "abc" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: "abc" } });
  });

  it("apiCreated merges extra keys", async () => {
    const res = apiCreated({ id: 1 }, { location: "/api/v1/items/1" });
    const body = await res.json();
    expect(body.location).toBe("/api/v1/items/1");
  });

  it("apiNoContent returns 204 with empty body", async () => {
    const res = apiNoContent();
    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe("");
  });

  it("apiList returns 200 with pagination meta", async () => {
    const pagination = { page: 1, pageSize: 10, total: 25, totalPages: 3 };
    const res = apiList([1, 2, 3], pagination);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([1, 2, 3]);
    expect(body.pagination).toEqual(pagination);
  });
});

describe("response helpers — error envelope", () => {
  it("apiError returns the correct shape and status", async () => {
    const res = apiError(ErrorCode.BAD_REQUEST, "Invalid input", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "Invalid input" },
    });
  });

  it("apiError includes details when provided", async () => {
    const res = apiError(ErrorCode.VALIDATION_ERROR, "Validation failed", 422, {
      field: "title",
      issue: "required",
    });
    const body = await res.json();
    expect(body.error.details).toEqual({ field: "title", issue: "required" });
  });

  it("apiError omits details when undefined", async () => {
    const res = apiError(ErrorCode.NOT_FOUND, "Not found", 404);
    const body = await res.json();
    expect(body.error.details).toBeUndefined();
  });
});

describe("convenience wrappers — correct error code + HTTP status", () => {
  it("apiBadRequest → 400 BAD_REQUEST", async () => {
    const res = apiBadRequest("bad");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(body.error.message).toBe("bad");
  });

  it("apiValidationError → 422 VALIDATION_ERROR", async () => {
    const res = apiValidationError("invalid", { field: "x" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(body.error.details).toEqual({ field: "x" });
  });

  it("apiUnauthorized → 401 UNAUTHORIZED with default message", async () => {
    const res = apiUnauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(body.error.message).toContain("Unauthorized");
  });

  it("apiUnauthorized accepts custom message", async () => {
    const res = apiUnauthorized("Custom auth message");
    const body = await res.json();
    expect(body.error.message).toBe("Custom auth message");
  });

  it("apiForbidden → 403 FORBIDDEN", async () => {
    const res = apiForbidden();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it("apiNotFound → 404 NOT_FOUND", async () => {
    const res = apiNotFound();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("apiConflict → 409 CONFLICT with details", async () => {
    const res = apiConflict("version mismatch", { currentVersion: 3 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.CONFLICT);
    expect(body.error.details).toEqual({ currentVersion: 3 });
  });

  it("apiRateLimited → 429 RATE_LIMITED", async () => {
    const res = apiRateLimited();
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it("apiMethodNotAllowed → 405 METHOD_NOT_ALLOWED", async () => {
    const res = apiMethodNotAllowed();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.METHOD_NOT_ALLOWED);
  });

  it("apiInternalError → 500 INTERNAL_ERROR", async () => {
    const res = apiInternalError();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("apiInternalError accepts custom message", async () => {
    const res = apiInternalError("DB down");
    const body = await res.json();
    expect(body.error.message).toBe("DB down");
  });
});

describe("ErrorCode — stable contract", () => {
  it("has exactly 13 error codes", () => {
    const codes = Object.values(ErrorCode);
    expect(codes).toHaveLength(13);
  });

  it("each code is a non-empty string", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("all codes are unique", () => {
    const codes = Object.values(ErrorCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
