import { describe, it, expect, beforeEach, vi } from "vitest";
import { enqueueSyncOp, flushSyncQueue, useSyncQueue } from "@/lib/sync/queue";

describe("Sync Queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should enqueue a write operation", () => {
    const id = enqueueSyncOp("POST", "/api/contacts", {
      name: "Test",
      phone: "+1",
    });
    expect(id).toBeTruthy();
    const raw = localStorage.getItem("sync-queue");
    expect(raw).toBeTruthy();
    const q = JSON.parse(raw!);
    expect(q).toHaveLength(1);
    expect(q[0].method).toBe("POST");
    expect(q[0].url).toBe("/api/contacts");
    expect(q[0].status).toBe("pending");
    expect(q[0].body).toEqual({ name: "Test", phone: "+1" });
  });

  it("should flush the queue and mark ops synced on success", async () => {
    // Mock successful fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    enqueueSyncOp("POST", "/api/notes", { title: "t", content: "c" });
    enqueueSyncOp("DELETE", "/api/notes?id=x");

    const result = await flushSyncQueue();
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Queue should be empty after successful flush
    const raw = localStorage.getItem("sync-queue");
    expect(JSON.parse(raw!)).toHaveLength(0);

    vi.unstubAllGlobals();
  });

  it("should retry transient failures (5xx) and keep them pending", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    vi.stubGlobal("fetch", fetchMock);

    enqueueSyncOp("POST", "/api/tasks", { title: "t" });
    const result = await flushSyncQueue();
    expect(result.synced).toBe(0);
    // 503 is transient → stays pending for retry
    const q = JSON.parse(localStorage.getItem("sync-queue")!);
    expect(q[0].status).toBe("pending");
    expect(q[0].attempts).toBe(1);
    expect(q[0].lastError).toBe("HTTP 503");

    vi.unstubAllGlobals();
  });

  it("should NOT retry 4xx permanent errors (except 408/429)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });
    vi.stubGlobal("fetch", fetchMock);

    enqueueSyncOp("POST", "/api/tasks", { title: "t" });
    const result = await flushSyncQueue();
    expect(result.failed).toBe(1);
    const q = JSON.parse(localStorage.getItem("sync-queue")!);
    expect(q[0].status).toBe("failed");

    vi.unstubAllGlobals();
  });

  it("should treat 404 on DELETE as success (already gone)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", fetchMock);

    enqueueSyncOp("DELETE", "/api/notes?id=ghost");
    const result = await flushSyncQueue();
    expect(result.synced).toBe(1);

    vi.unstubAllGlobals();
  });
});
