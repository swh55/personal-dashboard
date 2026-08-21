// =============================================================================
// Tests: src/lib/api/crud.ts — generic CRUD factory
// =============================================================================
// Verifies (with mocked Prisma + auth):
//   - Create: valid body → calls prisma create with userId + version:1 → 201 + records SyncEvent
//   - Create: unique constraint violation → 409 CONFLICT
//   - Update: valid → bumps version → records SyncEvent
//   - Update: baseVersion mismatch → 409 CONFLICT with currentVersion
//   - Update: record not found / wrong userId → 404
//   - Delete: soft-delete (sets deletedAt + bumps version)
//   - Delete: force=true → hard delete
//   - List: applies pagination, filters, excludes soft-deleted by default

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Hoisted mock state — referenced by vi.mock factories below.
// ---------------------------------------------------------------------------
const {
  mockRequirePrincipal,
  mockTaskDelegate,
  mockSyncEventDelegate,
  mockTx,
  mockDb,
  mockLogActivity,
} = vi.hoisted(() => {
  const mockTaskDelegate = {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const mockSyncEventDelegate = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const mockTx = {
    task: mockTaskDelegate,
    syncEvent: mockSyncEventDelegate,
  };
  const mockDb = {
    $transaction: vi.fn(),
    task: mockTaskDelegate,
    syncEvent: mockSyncEventDelegate,
  };
  return {
    mockRequirePrincipal: vi.fn(),
    mockTaskDelegate,
    mockSyncEventDelegate,
    mockTx,
    mockDb,
    mockLogActivity: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/activity", () => ({ logActivity: mockLogActivity }));
vi.mock("@/lib/api/auth-v1", () => ({
  requirePrincipal: mockRequirePrincipal,
  assertOwnership: vi.fn().mockReturnValue(null),
}));

import { createCollectionHandlers, createItemHandlers } from "@/lib/api/crud";
import { tasksConfig } from "@/lib/api/entities";
import { ErrorCode } from "@/lib/api/response";

const USER_ID = "user-123";
const DEVICE_ID = "device-abc";

function setAuthPrincipal(ok: boolean) {
  if (ok) {
    mockRequirePrincipal.mockResolvedValue({
      ok: true as const,
      principal: {
        userId: USER_ID,
        email: "",
        authMethod: "bearer" as const,
        deviceId: DEVICE_ID,
      },
    });
  } else {
    mockRequirePrincipal.mockResolvedValue({
      ok: false as const,
      response: new NextResponse(
        JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    });
  }
}

function makeGetReq(query: string = ""): NextRequest {
  return new NextRequest(`http://localhost/api/v1/tasks${query}`);
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePatchReq(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/v1/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteReq(id: string, query: string = ""): NextRequest {
  return new NextRequest(`http://localhost/api/v1/tasks/${id}${query}`, {
    method: "DELETE",
  });
}

describe("CRUD factory — createCollectionHandlers (GET + POST)", () => {
  let handlers: ReturnType<typeof createCollectionHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    setAuthPrincipal(true);
    // Default: $transaction invokes the callback with mockTx.
    mockDb.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
    // logActivity returns a resolved Promise (the CRUD factory calls .catch() on it).
    mockLogActivity.mockResolvedValue(undefined);
    handlers = createCollectionHandlers(tasksConfig);
  });

  // -------------------------------------------------------------------------
  // GET (list)
  // -------------------------------------------------------------------------
  describe("GET (list)", () => {
    it("returns 401 when principal is not authenticated", async () => {
      setAuthPrincipal(false);
      const res = await handlers.GET(makeGetReq());
      expect(res.status).toBe(401);
    });

    it("returns a paginated list of tasks", async () => {
      const mockTasks = [
        { id: "t1", title: "Task 1", userId: USER_ID, version: 1, deletedAt: null },
        { id: "t2", title: "Task 2", userId: USER_ID, version: 1, deletedAt: null },
      ];
      mockTaskDelegate.findMany.mockResolvedValue(mockTasks);
      mockTaskDelegate.count.mockResolvedValue(2);

      const res = await handlers.GET(makeGetReq("?page=1&pageSize=10"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it("excludes soft-deleted records by default (deletedAt: null in where)", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq());

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeNull();
      expect(findManyCall.where.userId).toBe(USER_ID);
    });

    it("includes soft-deleted records when includeDeleted=true", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?includeDeleted=true"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeUndefined();
    });

    it("applies pagination (skip + take)", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?page=3&pageSize=20"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(40); // (3-1) * 20
      expect(findManyCall.take).toBe(20);
    });

    it("clamps pageSize to MAX_PAGE_SIZE (100)", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?pageSize=999"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(100);
    });

    it("applies whitelisted filters", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?status=done&priority=high"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe("done");
      expect(findManyCall.where.priority).toBe("high");
    });

    it("does NOT apply non-whitelisted filters (mass-assignment protection)", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?userId=evil&createdAt=2024-01-01"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      // The userId in where must be the session userId, NOT the query param.
      expect(findManyCall.where.userId).toBe(USER_ID);
      expect(findManyCall.where.createdAt).toBeUndefined();
    });

    it("applies sort field + direction", async () => {
      mockTaskDelegate.findMany.mockResolvedValue([]);
      mockTaskDelegate.count.mockResolvedValue(0);

      await handlers.GET(makeGetReq("?sort=-priority"));

      const findManyCall = mockTaskDelegate.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ priority: "desc" });
    });

    it("returns 500 on unexpected error", async () => {
      mockTaskDelegate.findMany.mockRejectedValue(new Error("DB down"));

      const res = await handlers.GET(makeGetReq());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  // -------------------------------------------------------------------------
  // POST (create)
  // -------------------------------------------------------------------------
  describe("POST (create)", () => {
    it("returns 401 when principal is not authenticated", async () => {
      setAuthPrincipal(false);
      const res = await handlers.POST(makePostReq({ title: "Test" }));
      expect(res.status).toBe(401);
    });

    it("creates a record with userId + version:1 and returns 201", async () => {
      const created = {
        id: "new-task-id",
        title: "New Task",
        userId: USER_ID,
        version: 1,
        status: "todo",
        deletedAt: null,
      };
      mockTaskDelegate.create.mockResolvedValue(created);
      mockSyncEventDelegate.findFirst.mockResolvedValue(null); // nextSeq → 1n
      mockSyncEventDelegate.create.mockResolvedValue({ seq: 1n });

      const res = await handlers.POST(makePostReq({ title: "New Task" }));

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("New Task");

      // Verify the create call included userId + version:1.
      const createCall = mockTaskDelegate.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe(USER_ID);
      expect(createCall.data.version).toBe(1);
      expect(createCall.data.title).toBe("New Task");
    });

    it("records a SyncEvent inside the transaction", async () => {
      mockTaskDelegate.create.mockResolvedValue({
        id: "t1",
        title: "T",
        userId: USER_ID,
        version: 1,
      });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);
      mockSyncEventDelegate.create.mockResolvedValue({ seq: 1n });

      await handlers.POST(makePostReq({ title: "T" }));

      // recordSyncEvent calls syncEvent.create inside the txn.
      expect(mockSyncEventDelegate.create).toHaveBeenCalledTimes(1);
      const syncCall = mockSyncEventDelegate.create.mock.calls[0][0];
      expect(syncCall.data.userId).toBe(USER_ID);
      expect(syncCall.data.entity).toBe("task");
      expect(syncCall.data.operation).toBe("create");
    });

    it("returns 422 for invalid body (missing required field)", async () => {
      const res = await handlers.POST(makePostReq({ description: "no title" }));
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("returns 422 for body with unknown field (strict mode)", async () => {
      const res = await handlers.POST(
        makePostReq({ title: "T", userId: "evil" })
      );
      expect(res.status).toBe(422);
    });

    it("returns 409 CONFLICT on unique constraint violation (P2002)", async () => {
      mockTaskDelegate.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("unique", {
          code: "P2002",
          clientVersion: "6.0.0",
        })
      );
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.POST(makePostReq({ title: "Dup" }));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.CONFLICT);
    });

    it("returns 500 on unexpected Prisma error", async () => {
      mockTaskDelegate.create.mockRejectedValue(new Error("Unexpected"));
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.POST(makePostReq({ title: "T" }));
      expect(res.status).toBe(500);
    });

    it("logs activity after successful create", async () => {
      mockTaskDelegate.create.mockResolvedValue({
        id: "t1",
        title: "T",
        userId: USER_ID,
        version: 1,
      });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);
      mockSyncEventDelegate.create.mockResolvedValue({ seq: 1n });

      await handlers.POST(makePostReq({ title: "T" }));

      expect(mockLogActivity).toHaveBeenCalledWith(
        "create",
        "task",
        expect.any(String),
        USER_ID
      );
    });
  });
});

describe("CRUD factory — createItemHandlers (GET + PATCH + DELETE)", () => {
  let handlers: ReturnType<typeof createItemHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    setAuthPrincipal(true);
    mockDb.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
    // logActivity returns a resolved Promise (the CRUD factory calls .catch() on it).
    mockLogActivity.mockResolvedValue(undefined);
    handlers = createItemHandlers(tasksConfig);
  });

  // -------------------------------------------------------------------------
  // PATCH (update)
  // -------------------------------------------------------------------------
  describe("PATCH (update)", () => {
    it("returns 401 when principal is not authenticated", async () => {
      setAuthPrincipal(false);
      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "Updated" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );
      expect(res.status).toBe(401);
    });

    it("updates a record, bumps version, and records SyncEvent", async () => {
      const existing = {
        id: "task-1",
        title: "Old",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      };
      const updated = { ...existing, title: "Updated", version: 2 };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);
      mockTaskDelegate.update.mockResolvedValue(updated);
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "Updated" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title).toBe("Updated");

      // Verify version increment.
      const updateCall = mockTaskDelegate.update.mock.calls[0][0];
      expect(updateCall.data.version).toEqual({ increment: 1 });

      // Verify SyncEvent was recorded.
      expect(mockSyncEventDelegate.create).toHaveBeenCalledTimes(1);
      const syncCall = mockSyncEventDelegate.create.mock.calls[0][0];
      expect(syncCall.data.operation).toBe("update");
    });

    it("returns 409 CONFLICT when baseVersion does not match", async () => {
      const existing = {
        id: "task-1",
        title: "Current",
        userId: USER_ID,
        version: 5,
        deletedAt: null,
      };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);

      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "Stale", baseVersion: 3 }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.CONFLICT);
      expect(body.error.details.currentVersion).toBe(5);
      expect(body.error.details.baseVersion).toBe(3);

      // The update should NOT have been called.
      expect(mockTaskDelegate.update).not.toHaveBeenCalled();
    });

    it("skips version check when baseVersion is not supplied (last-write-wins)", async () => {
      const existing = {
        id: "task-1",
        title: "Old",
        userId: USER_ID,
        version: 5,
        deletedAt: null,
      };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);
      mockTaskDelegate.update.mockResolvedValue({ ...existing, title: "New", version: 6 });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "New" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
      expect(mockTaskDelegate.update).toHaveBeenCalled();
    });

    it("returns 404 when record does not exist", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue(null);

      const res = await handlers.PATCH(
        makePatchReq("nonexistent", { title: "X" }),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it("returns 404 when record belongs to a different user", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Other",
        userId: "different-user",
        version: 1,
        deletedAt: null,
      });

      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "X" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when record is soft-deleted", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Deleted",
        userId: USER_ID,
        version: 1,
        deletedAt: new Date("2024-01-01"),
      });

      const res = await handlers.PATCH(
        makePatchReq("task-1", { title: "X" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid body (unknown field)", async () => {
      const res = await handlers.PATCH(
        makePatchReq("task-1", { hackerField: "evil" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(422);
    });

    it("strips userId and id from update data (never allow reassignment)", async () => {
      const existing = {
        id: "task-1",
        title: "Old",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);
      mockTaskDelegate.update.mockResolvedValue({ ...existing, version: 2 });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      await handlers.PATCH(
        makePatchReq("task-1", { title: "Updated" }),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      const updateCall = mockTaskDelegate.update.mock.calls[0][0];
      expect(updateCall.data.userId).toBeUndefined();
      expect(updateCall.data.id).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------
  describe("DELETE", () => {
    it("returns 401 when principal is not authenticated", async () => {
      setAuthPrincipal(false);
      const res = await handlers.DELETE(
        makeDeleteReq("task-1"),
        { params: Promise.resolve({ id: "task-1" }) }
      );
      expect(res.status).toBe(401);
    });

    it("soft-deletes by default (sets deletedAt + bumps version)", async () => {
      const existing = {
        id: "task-1",
        title: "T",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);
      mockTaskDelegate.update.mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
        version: 2,
      });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.DELETE(
        makeDeleteReq("task-1"),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.deleted).toBe(true);
      expect(body.data.soft).toBe(true);

      // Verify soft-delete update: sets deletedAt + increments version.
      const updateCall = mockTaskDelegate.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
      expect(updateCall.data.version).toEqual({ increment: 1 });
      // Hard delete should NOT have been called.
      expect(mockTaskDelegate.delete).not.toHaveBeenCalled();

      // SyncEvent should be recorded with operation="delete".
      expect(mockSyncEventDelegate.create).toHaveBeenCalledTimes(1);
      const syncCall = mockSyncEventDelegate.create.mock.calls[0][0];
      expect(syncCall.data.operation).toBe("delete");
    });

    it("hard-deletes when force=true", async () => {
      const existing = {
        id: "task-1",
        title: "T",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      };
      mockTaskDelegate.findUnique.mockResolvedValue(existing);
      mockTaskDelegate.delete.mockResolvedValue(existing);
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      const res = await handlers.DELETE(
        makeDeleteReq("task-1", "?force=true"),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.deleted).toBe(true);
      expect(body.data.soft).toBe(false);

      // Hard delete was called.
      expect(mockTaskDelegate.delete).toHaveBeenCalledTimes(1);
      // Soft-delete update was NOT called.
      expect(mockTaskDelegate.update).not.toHaveBeenCalled();
    });

    it("returns 404 when record does not exist", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue(null);

      const res = await handlers.DELETE(
        makeDeleteReq("nonexistent"),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when record belongs to a different user", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "T",
        userId: "different-user",
        version: 1,
        deletedAt: null,
      });

      const res = await handlers.DELETE(
        makeDeleteReq("task-1"),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(404);
    });

    it("logs activity after successful delete", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "T",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      });
      mockTaskDelegate.update.mockResolvedValue({
        deletedAt: new Date(),
        version: 2,
      });
      mockSyncEventDelegate.findFirst.mockResolvedValue(null);

      await handlers.DELETE(
        makeDeleteReq("task-1"),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(mockLogActivity).toHaveBeenCalledWith(
        "delete",
        "task",
        expect.any(String),
        USER_ID
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET (single item)
  // -------------------------------------------------------------------------
  describe("GET (single item)", () => {
    it("returns 401 when principal is not authenticated", async () => {
      setAuthPrincipal(false);
      const res = await handlers.GET(
        makeGetReq(),
        { params: Promise.resolve({ id: "task-1" }) }
      );
      expect(res.status).toBe(401);
    });

    it("returns the record when owned by the caller", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "My Task",
        userId: USER_ID,
        version: 1,
        deletedAt: null,
      });

      const res = await handlers.GET(
        makeGetReq(),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.title).toBe("My Task");
    });

    it("returns 404 when record belongs to a different user", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Other",
        userId: "different-user",
        version: 1,
        deletedAt: null,
      });

      const res = await handlers.GET(
        makeGetReq(),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when record is soft-deleted (by default)", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Deleted",
        userId: USER_ID,
        version: 1,
        deletedAt: new Date(),
      });

      const res = await handlers.GET(
        makeGetReq(),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(404);
    });

    it("returns soft-deleted record when includeDeleted=true", async () => {
      mockTaskDelegate.findUnique.mockResolvedValue({
        id: "task-1",
        title: "Deleted",
        userId: USER_ID,
        version: 1,
        deletedAt: new Date(),
      });

      const res = await handlers.GET(
        makeGetReq("?includeDeleted=true"),
        { params: Promise.resolve({ id: "task-1" }) }
      );

      expect(res.status).toBe(200);
    });
  });
});
