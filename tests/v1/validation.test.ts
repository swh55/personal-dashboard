// =============================================================================
// Tests: src/lib/api/validation.ts — zod parseBody + strict mode
// =============================================================================
// Verifies:
//   - Valid body passes and returns parsed data
//   - Invalid JSON returns a 422 error response
//   - Missing required fields → 422 with details
//   - Extra/unknown fields → 422 (strict mode rejects mass-assignment)
//   - Fields that must be rejected: userId, id, createdAt, updatedAt, version

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseBody, schemas } from "@/lib/api/validation";

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/tasks", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// A representative strict schema (mirrors the task entity pattern).
const testSchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().max(20000).optional().nullable(),
    status: z.enum(["todo", "doing", "done"]).default("todo"),
  })
  .strict();

describe("parseBody — valid body", () => {
  it("returns { ok: true, data } for a valid body", async () => {
    const req = makePostReq({ title: "My Task" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("My Task");
      expect(result.data.status).toBe("todo"); // default applied
    }
  });

  it("applies zod defaults", async () => {
    const req = makePostReq({ title: "Test" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("todo");
    }
  });

  it("accepts nullable optional fields", async () => {
    const req = makePostReq({ title: "Test", description: null });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.description).toBeNull();
    }
  });
});

describe("parseBody — invalid JSON", () => {
  it("returns 422 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      body: "{ not valid json",
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const body = await result.response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("valid JSON");
    }
  });

  it("returns 422 for empty body", async () => {
    const req = new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      body: "",
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
    }
  });
});

describe("parseBody — missing required fields", () => {
  it("returns 422 when required field 'title' is missing", async () => {
    const req = makePostReq({ description: "no title" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const body = await result.response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
      expect(body.error.details.title).toBeDefined();
    }
  });

  it("returns 422 when title is empty string", async () => {
    const req = makePostReq({ title: "" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const body = await result.response.json();
      expect(body.error.details.title).toBeDefined();
    }
  });

  it("returns 422 for invalid enum value", async () => {
    const req = makePostReq({ title: "Test", status: "invalid_status" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.details.status).toBeDefined();
    }
  });
});

describe("parseBody — strict mode (mass-assignment protection)", () => {
  it("rejects unknown field 'userId'", async () => {
    const req = makePostReq({
      title: "Test",
      userId: "victim-user-id",
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const body = await result.response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      // zod strict mode reports unrecognized keys — details is non-empty.
      expect(body.error.details).toBeDefined();
      expect(Object.keys(body.error.details).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects unknown field 'id'", async () => {
    const req = makePostReq({ title: "Test", id: "custom-id" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown field 'createdAt'", async () => {
    const req = makePostReq({
      title: "Test",
      createdAt: "2024-01-01T00:00:00Z",
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown field 'updatedAt'", async () => {
    const req = makePostReq({
      title: "Test",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown field 'version'", async () => {
    const req = makePostReq({ title: "Test", version: 1 });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown field 'deletedAt'", async () => {
    const req = makePostReq({ title: "Test", deletedAt: null });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects multiple unknown fields", async () => {
    const req = makePostReq({
      title: "Test",
      userId: "evil",
      id: "evil",
      createdAt: "2024-01-01",
    });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      // zod may batch all unrecognized keys into a single _root issue or
      // report each separately — either way, details is non-empty.
      expect(Object.keys(body.error.details).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects arbitrary unknown field", async () => {
    const req = makePostReq({ title: "Test", hackerField: "pwned" });
    const result = await parseBody(req, testSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      // The error message should mention the unrecognized key.
      const detailsStr = JSON.stringify(body.error.details);
      expect(detailsStr).toContain("hackerField");
    }
  });
});

describe("schemas — reusable primitives", () => {
  it("schemas.float accepts finite numbers", () => {
    expect(schemas.float.safeParse(3.14).success).toBe(true);
    expect(schemas.float.safeParse(-100).success).toBe(true);
  });

  it("schemas.float rejects NaN and Infinity", () => {
    expect(schemas.float.safeParse(NaN).success).toBe(false);
    expect(schemas.float.safeParse(Infinity).success).toBe(false);
  });

  it("schemas.positiveFloat accepts positive numbers", () => {
    expect(schemas.positiveFloat.safeParse(0.01).success).toBe(true);
  });

  it("schemas.positiveFloat rejects zero and negatives", () => {
    expect(schemas.positiveFloat.safeParse(0).success).toBe(false);
    expect(schemas.positiveFloat.safeParse(-1).success).toBe(false);
  });

  it("schemas.nonNegativeInt accepts 0 and positive ints", () => {
    expect(schemas.nonNegativeInt.safeParse(0).success).toBe(true);
    expect(schemas.nonNegativeInt.safeParse(42).success).toBe(true);
  });

  it("schemas.nonNegativeInt rejects negative and non-int", () => {
    expect(schemas.nonNegativeInt.safeParse(-1).success).toBe(false);
    expect(schemas.nonNegativeInt.safeParse(3.14).success).toBe(false);
  });

  it("schemas.isoDate accepts ISO datetime strings", () => {
    expect(schemas.isoDate.safeParse("2024-01-01T00:00:00Z").success).toBe(true);
    expect(
      schemas.isoDate.safeParse("2024-01-01T00:00:00+02:00").success
    ).toBe(true);
  });

  it("schemas.isoDate rejects non-ISO strings", () => {
    expect(schemas.isoDate.safeParse("2024-01-01").success).toBe(false);
    expect(schemas.isoDate.safeParse("not a date").success).toBe(false);
  });

  it("schemas.version accepts int >= 1 or undefined", () => {
    expect(schemas.version.safeParse(1).success).toBe(true);
    expect(schemas.version.safeParse(42).success).toBe(true);
    expect(schemas.version.safeParse(undefined).success).toBe(true);
  });

  it("schemas.version rejects 0, negatives, non-int", () => {
    expect(schemas.version.safeParse(0).success).toBe(false);
    expect(schemas.version.safeParse(-1).success).toBe(false);
    expect(schemas.version.safeParse(1.5).success).toBe(false);
  });
});
