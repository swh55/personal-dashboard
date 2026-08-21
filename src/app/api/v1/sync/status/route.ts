// =============================================================================
// GET /api/v1/sync/status — sync metadata for the current user
// =============================================================================
// Returns:
//   - latestSeq: the highest SyncEvent.seq for this user (use as cursor)
//   - eventCount: total events
//   - lastEventAt: timestamp of the most recent event
//   - perEntity: { tasks: { count, lastSeq, lastEventAt }, ... }
//   - device: info about the calling device (if bearer)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { SYNC_ENTITIES } from "@/lib/api/sync";
import { apiSuccess, apiInternalError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;

  try {
    const [latest, count, perEntityRows] = await Promise.all([
      db.syncEvent.findFirst({
        where: { userId },
        orderBy: { seq: "desc" },
        select: { seq: true, createdAt: true },
      }),
      db.syncEvent.count({ where: { userId } }),
      db.syncEvent.groupBy({
        by: ["entity"],
        where: { userId },
        _count: { seq: true },
        _max: { seq: true, createdAt: true },
      }),
    ]);

    const perEntity: Record<string, { count: number; lastSeq: string | null; lastEventAt: string | null }> = {};
    for (const row of perEntityRows) {
      // Map delegate name -> plural name for client-friendliness
      const cfg = SYNC_ENTITIES.find((e) => e.delegate === row.entity);
      const key = cfg?.plural ?? row.entity;
      perEntity[key] = {
        count: row._count.seq,
        lastSeq: row._max.seq?.toString() ?? null,
        lastEventAt: row._max.createdAt?.toISOString() ?? null,
      };
    }

    let deviceInfo = null;
    if (deviceId) {
      const dev = await db.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          platform: true,
          appVersion: true,
          lastSeenAt: true,
          revokedAt: true,
        },
      });
      deviceInfo = dev;
    }

    return apiSuccess({
      latestSeq: latest?.seq.toString() ?? "0",
      eventCount: count,
      lastEventAt: latest?.createdAt.toISOString() ?? null,
      perEntity,
      device: deviceInfo,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[sync/status] error:", err);
    return apiInternalError();
  }
}
