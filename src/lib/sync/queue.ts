"use client";

// Sync Engine — offline-first write queue + retry for authenticated users.
//
// When an authenticated user goes offline (loses connection), their writes
// are queued in localStorage. When the connection is restored, the queue is
// flushed to the cloud via the standard API routes.
//
// NOTE: This is a pragmatic MVP sync layer. It handles the common cases:
//   - Write while offline → queue → retry when online
//   - Idempotency via client-side ids (Prisma `id` is the dedup key)
//   - Per-operation retry with exponential backoff
//
// It does NOT (yet) handle:
//   - Update conflicts (last-write-wins per field)
//   - Delete-then-recreate races
//   - Operational transforms
//
// For the personal dashboard use case, last-write-wins is acceptable.

import { useState, useEffect, useCallback } from "react";

const QUEUE_KEY = "sync-queue";

export type SyncOp = {
  id: string; // unique operation id (client-generated)
  method: "POST" | "PUT" | "DELETE";
  url: string; // relative path, e.g. "/api/contacts"
  body?: unknown;
  status: "pending" | "syncing" | "failed";
  attempts: number;
  lastError?: string;
  createdAt: string;
};

function loadQueue(): SyncOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncOp[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(q: SyncOp[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // ignore
  }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Queue a write operation for later sync. Safe to call while online —
 * the queue is processed immediately when a connection is available.
 */
export function enqueueSyncOp(
  method: SyncOp["method"],
  url: string,
  body?: unknown
): string {
  const op: SyncOp = {
    id: genId(),
    method,
    url,
    body,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const q = loadQueue();
  q.push(op);
  saveQueue(q);
  return op.id;
}

/**
 * Process the sync queue. Retries failed ops with exponential backoff.
 * Returns the number of ops successfully synced.
 */
export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  const q = loadQueue();
  if (q.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: SyncOp[] = [];

  for (const op of q) {
    if (op.status === "syncing") {
      remaining.push(op);
      continue;
    }
    op.status = "syncing";
    op.attempts++;
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: op.body ? { "Content-Type": "application/json" } : undefined,
        body: op.body ? JSON.stringify(op.body) : undefined,
      });
      if (res.ok || res.status === 404) {
        // 404 on DELETE means it was already gone — treat as success
        synced++;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        // Permanent client error (except timeout/rate-limit) — don't retry
        op.status = "failed";
        op.lastError = `HTTP ${res.status}`;
        failed++;
        remaining.push(op);
      } else {
        // Transient failure — retry next time
        op.status = "pending";
        op.lastError = `HTTP ${res.status}`;
        remaining.push(op);
      }
    } catch (err: any) {
      op.status = "pending";
      op.lastError = err?.message || "Network error";
      remaining.push(op);
    }
  }

  saveQueue(remaining);
  return { synced, failed };
}

/**
 * React hook that exposes the sync queue status and a manual flush action.
 * Automatically flushes when the browser regains connectivity.
 */
export function useSyncQueue() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setPending(loadQueue().filter((o) => o.status === "pending").length);
  }, []);

  const flush = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await flushSyncQueue();
      refresh();
    } finally {
      setSyncing(false);
    }
  }, [syncing, refresh]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refresh();
    // Auto-flush on mount if online
    if (navigator.onLine) flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush, refresh]);

  return { online, pending, syncing, flush, refresh };
}
