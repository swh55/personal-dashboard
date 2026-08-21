// =============================================================================
// GET /api/v1/sync/pull — delta sync: fetch changes since a cursor
// =============================================================================
// Query params:
//   cursor     — the last `seq` the client has applied (0 or omitted = full pull)
//   collections — comma-separated entity plural names to limit the pull
//                 (e.g. "tasks,contacts"). Omit to pull all sync-enabled entities.
//   pageSize   — max events to return (default 500, max 1000)
//
// Response:
//   {
//     success: true,
//     data: { events: [...], nextCursor: 123, hasMore: false, serverTime: ISO }
//   }
//
// Each event: { seq, entity, entityId, operation, payload, createdAt }
// Clients apply events in `seq` order (last-write-wins). Deletes have a
// minimal payload `{ id, deletedAt }`.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { SYNC_ENTITIES } from "@/lib/api/sync";
import { apiSuccess, apiInternalError } from "@/lib/api/response";

const MAX_PULL_PAGE = 1000;
const DEFAULT_PULL_PAGE = 500;

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const sp = req.nextUrl.searchParams;
  const cursorStr = sp.get("cursor");
  let cursor = 0n;
  if (cursorStr) {
    try {
      cursor = BigInt(cursorStr);
    } catch {
      return apiSuccess({
        events: [],
        nextCursor: 0,
        hasMore: false,
        serverTime: new Date().toISOString(),
        error: "Invalid cursor — must be a non-negative integer",
      });
    }
  }

  let pageSize = parseInt(sp.get("pageSize") ?? String(DEFAULT_PULL_PAGE), 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = DEFAULT_PULL_PAGE;
  if (pageSize > MAX_PULL_PAGE) pageSize = MAX_PULL_PAGE;

  // Optional collection filter
  const collectionsParam = sp.get("collections");
  let allowedEntities: string[] | null = null;
  if (collectionsParam) {
    const requested = collectionsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Validate against the sync registry — drop unknowns.
    allowedEntities = SYNC_ENTITIES.filter((e) =>
      requested.includes(e.plural)
    ).map((e) => e.plural);
  }

  try {
    // Query SyncEvent rows with seq > cursor, ordered by seq.
    const where: Record<string, unknown> = {
      userId,
      seq: { gt: cursor },
    };
    if (allowedEntities && allowedEntities.length > 0) {
      // Map plural names back to the `entity` field values (delegate names).
      const delegateNames = SYNC_ENTITIES.filter((e) =>
        allowedEntities!.includes(e.plural)
      ).map((e) => e.delegate);
      where.entity = { in: delegateNames };
    }

    const events = await db.syncEvent.findMany({
      where,
      orderBy: { seq: "asc" },
      take: pageSize + 1, // +1 to detect hasMore
      select: {
        seq: true,
        entity: true,
        entityId: true,
        operation: true,
        payload: true,
        createdAt: true,
        deviceId: true,
      },
    });

    const hasMore = events.length > pageSize;
    const page = hasMore ? events.slice(0, pageSize) : events;
    const nextCursor = page.length > 0 ? page[page.length - 1].seq : cursor;

    return apiSuccess({
      events: page.map((e) => ({
        seq: e.seq.toString(),
        entity: e.entity,
        entityId: e.entityId,
        operation: e.operation,
        payload: safeParseJson(e.payload),
        createdAt: e.createdAt.toISOString(),
        deviceId: e.deviceId,
      })),
      nextCursor: nextCursor.toString(),
      hasMore,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[sync/pull] error:", err);
    return apiInternalError();
  }
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
